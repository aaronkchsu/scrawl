import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HostedGame } from './hosted-game.ts';
import { PostgresHostedStore, type HostedStorage } from './hosted-store.ts';
import { TokenVault, opaque, digest } from './hosted-auth.ts';
import { TwitchConnections, type Credentials } from './twitch.ts';
import { AIProvider } from './ai.ts';
import { caveCreator } from './expedition-caves.ts';
import { Expedition } from './expedition.ts';

const publicRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const cookie = (req: IncomingMessage) => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
type BrowserSession = { account?: string; expires: number; practice: boolean; game?: Expedition };
export async function createHostedApp(env = process.env, supplied?: HostedStorage) {
    const port = Number(env.PORT || 4177), host = env.HOST || '0.0.0.0';
    const baseUrl = (env.BASE_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    const origin = new URL(baseUrl).origin;
    if (!origin.startsWith('https:') && !['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Hosted Twitch requires an HTTPS BASE_URL.');
    const storage = supplied ?? await PostgresHostedStore.connect(env.DATABASE_URL || '');
    const service = new HostedGame(storage, new TokenVault(env.TOKEN_ENCRYPTION_KEY || ''), Number(env.MAX_ACTIVE_ROOMS || 10));
    if (!Number.isInteger(service.maxRooms) || service.maxRooms < 1 || service.maxRooms > 100) throw new Error('MAX_ACTIVE_ROOMS must be 1–100.');
    await service.reconnect();
    const ai = new AIProvider({ ...env, AI_USAGE_FILE: '', AI_MAX_REQUESTS: env.AI_MAX_REQUESTS || '14' });
    await service.change(d => {
        if (!d.usage.imported && env.AI_INITIAL_REQUESTS !== undefined) {
            const initial = { requests: Number(env.AI_INITIAL_REQUESTS), reportedRequests: Number(env.AI_INITIAL_REPORTED || 0), inputTokens: Number(env.AI_INITIAL_INPUT_TOKENS || 0), outputTokens: Number(env.AI_INITIAL_OUTPUT_TOKENS || 0) };
            if (!Object.values(initial).every(x => Number.isSafeInteger(x) && x >= 0) || initial.reportedRequests > initial.requests) throw new Error('Invalid initial AI ledger.');
            Object.assign(d.usage, initial, { imported: true });
        }
    });
    Object.assign(ai, storage.read(d => d.usage));
    ai.beforeRequest = () => service.change(d => {
        if (!d.usage.imported) throw new Error('AI usage must be imported before generation is enabled.');
        if (d.usage.requests >= ai.maxRequests) throw new Error('AI cap reached. Built-in caves still work.');
        d.usage.requests++;
    });
    ai.recordUsage = usage => service.change(d => { d.usage.inputTokens += usage.inputTokens; d.usage.outputTokens += usage.outputTokens; d.usage.reportedRequests += usage.reportedRequests; });
    const connections = new Map<string, TwitchConnections>(), browsers = new Map<string, BrowserSession>();
    const streams = new Map<ServerResponse, { key?: string; overlay?: string; practice?: boolean }>();
    const limits = new Map<string, { count: number; until: number }>();
    const operators = new Set((env.OPERATOR_TWITCH_IDS || '').split(',').filter(Boolean));
    let healthy = true, stopping = false, ticking = false;
    let lastTickAt = Date.now();
    const pendingJobs = new Set<AbortController>();
    const jobPromises = new Set<Promise<unknown>>();
    function session(req: IncomingMessage) {
        const key = digest(cookie(req).scrawl_session || '');
        const cached = browsers.get(key), saved = storage.read(d => d.sessions[key]);
        if (cached?.account && (!saved || saved.expires <= Date.now())) { browsers.delete(key); return { key, browser: undefined }; }
        if (cached && cached.expires > Date.now()) return { key, browser: cached };
        if (saved && saved.expires > Date.now()) { const browser: BrowserSession = { account: saved.account, expires: saved.expires, practice: false }; browsers.set(key, browser); return { key, browser }; }
        return { key, browser: undefined };
    }
    const capabilities = (account?: string) => {
        const d = storage.read(d => ({ usage: d.usage, enabled: Boolean(account && d.accounts[account]?.aiEnabled) }));
        return { hosted: true, twitch: Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET), aiRequests: d.usage.requests,
            ai: { ...ai.status(), ...d.usage, configured: Boolean(d.enabled && ai.configured && d.usage.imported), enabled: d.enabled } };
    };
    function practice(browser: BrowserSession) {
        if (!browser.game) {
            browser.game = new Expedition();
            if (browser.account) {
                const account = storage.read(d => d.accounts[browser.account!])!;
                browser.game.store.profiles = structuredClone(account.practiceProfiles);
                if (account.practice) browser.game.restore(account.practice, Date.now() - account.practice.savedAt);
            }
        }
        return browser.game;
    }
    function payload(browser: BrowserSession) {
        const live = browser.account ? service.payload(browser.account) : null;
        if (!browser.account || browser.practice) return { state: practice(browser).snapshot(), now: Date.now(), authenticated: true,
            account: live?.account ?? null, room: live?.room ?? null, liveChannel: live?.account ? live.state.channels[live.account.team] : null, practice: true, capabilities: capabilities(), healthy };
        return { ...live, authenticated: true, practice: false, capabilities: capabilities(browser.account), healthy };
    }
    function overlayPayload(id: string) {
        const a = storage.read(d => Object.values(d.accounts).find(a => a.overlay === id)?.id);
        if (!a) throw new Error('Overlay not found. Copy your link from Set up stream.');
        return { ...service.payload(a, true), healthy };
    }
    function broadcast() {
        // All windows for the same audience share one frame per committed tick.
        // Never reuse a host frame for an overlay or a different browser session.
        const frames = new Map<string, string>();
        for (const [res, target] of streams) {
            try {
                const frameKey = target.overlay ? `overlay:${target.overlay}` : `browser:${target.key}:${Boolean(target.practice)}`;
                const cached = frames.get(frameKey);
                if (res.writableLength > 512000) throw new Error('Reconnect.');
                if (cached) { res.write(cached); continue; }
                const browser = target.key ? browsers.get(target.key) : undefined;
                const saved = browser?.account && storage.read(d => d.sessions[target.key!]);
                if (browser?.account && (!saved || saved.expires <= Date.now())) throw new Error('Sign in again.');
                const data = target.overlay ? overlayPayload(target.overlay) : browser ? target.practice ? { state: practice(browser).snapshot(), now: Date.now(), healthy } : payload(browser) : null;
                if (!data) throw new Error('Reconnect.');
                const frame = `data: ${JSON.stringify(data)}\n\n`;
                frames.set(frameKey, frame); res.write(frame);
            } catch { res.end(); streams.delete(res); }
        }
    }
    function interrupted() {
        if (!healthy || stopping) return;
        healthy = false;
        // Do not accept more events after a failed transaction or lease handoff.
        for (const c of connections.values()) c.close();
        for (const job of pendingJobs) job.abort();
        broadcast();
    }
    const background = (promise: Promise<unknown>) => { void promise.catch(interrupted); };
    async function connect(id: string) {
        connections.get(id)?.close(); connections.delete(id);
        const account = storage.read(d => d.accounts[id]); if (!account?.credentials) return;
        const credentials = service.vault.open<Credentials>(account.credentials);
        const c = new TwitchConnections({ baseUrl,
            onMessage: m => { if (!stopping && healthy) background(service.ingest(id, m)); },
            onStatus: (_team, name, status, note) => { if (!stopping && healthy) background(service.channel(id, (g, team) => g.setConnection(team, name || account.login, status, note))); },
            onHype: e => { if (!stopping && healthy) background(service.channel(id, (g, team) => g.receiveHype({ ...e, team }), e.deliveryId, true)); },
            onGift: e => { if (!stopping && healthy) background(service.channel(id, (g, team) => g.receiveGift({ ...e, team }), e.id, true)); },
            onHypeStatus: (_team, available) => { if (!stopping && healthy) background(service.channel(id, (g, team) => g.setHypeAvailable(team, available))); },
            onGiftStatus: (_team, available) => { if (!stopping && healthy) background(service.channel(id, (g, team) => g.setGiftsAvailable(team, available))); },
            onCredentials: creds => service.change(d => { if (d.accounts[id]?.credentials) d.accounts[id]!.credentials = service.vault.seal(creds); }),
            onRevoked: () => service.change(d => { delete d.accounts[id]!.credentials; for (const [key, s] of Object.entries(d.sessions)) if (s.account === id) delete d.sessions[key]; }),
        }, env);
        connections.set(id, c); await c.connectCredentials(credentials);
    }
    const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    const setCookie = (res: ServerResponse, value: string, age = 86400) => res.setHeader('Set-Cookie', `scrawl_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`);
    const bodyOf = async (req: IncomingMessage) => { let raw = ''; for await (const part of req) { raw += part; if (raw.length > 16384) throw new Error('Request too large.'); } const value = raw ? JSON.parse(raw) : {}; if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request.'); return value; };
    const server = createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
        try {
            const url = new URL(req.url || '/', baseUrl);
            if (url.pathname === '/health') return json(res, healthy && !stopping ? 200 : 503, { ok: healthy && !stopping });
            if (req.headers.host !== new URL(baseUrl).host) return json(res, 403, { error: 'Unexpected host.' });
            let { key, browser } = session(req);
            if (req.method === 'POST' || url.pathname === '/auth/twitch') {
                const limitKey = browser ? key : req.socket.remoteAddress || 'unknown';
                let l = limits.get(limitKey); if (!l || l.until < Date.now()) { l = { count: 0, until: Date.now() + 60000 }; limits.set(limitKey, l); }
                if (++l.count > 60) return json(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
            }
            if (req.method === 'POST') {
                if (req.headers.origin !== origin) return json(res, 403, { error: 'Unexpected origin.' });
                const body = await bodyOf(req);
                if (url.pathname === '/api/session') {
                    if (!browser) {
                        if (browsers.size >= 1000) throw new Error('Practice is busy. Try again shortly.');
                        const token = opaque(); key = digest(token); browser = { expires: Date.now() + 3600000, practice: true };
                        browsers.set(key, browser); setCookie(res, token);
                    }
                    return json(res, 200, payload(browser));
                }
                if (!browser) return json(res, 401, { error: 'Sign in with Twitch or start a practice climb.' });
                if (!healthy) return json(res, 503, { error: 'Saving is unavailable. Play is paused until the server reconnects.' });
                if (url.pathname === '/api/logout') {
                    await service.change(d => { delete d.sessions[key]; }); browsers.delete(key); setCookie(res, '', 0); return json(res, 200, { ok: true });
                }
                if (url.pathname === '/api/action') {
                    if (body.action === 'demo') { browser.practice = true; practice(browser).setMode('demo'); }
                    else if (body.action === 'camp') { if (!browser.account) throw new Error('Sign in with Twitch to open your camp.'); browser.practice = false; }
                    else if (body.action === 'live') {
                        if (!browser.account) throw new Error('Sign in with Twitch first.');
                        await service.action(browser.account, { ...body, sessionId: browser.practice ? (service.payload(browser.account).state.id) : body.sessionId }); browser.practice = false;
                    }
                    else if (browser.practice) {
                        const g = practice(browser);
                        if (body.sessionId !== g.id) throw new Error('Practice restarted. Try again.');
                        if (body.action === 'dig') g.dig(String(body.playerId));
                        else if (body.action === 'choose') g.choose(String(body.playerId), String(body.runId), String(body.choice));
                        else if (body.action === 'equip') g.equip(String(body.playerId), body.item);
                        else if (body.action === 'settings') g.configure(body.settings || {});
                        else if (body.action === 'rescue-practice') g.startRescuePractice();
                        else if (body.action === 'hype' && [0, 1, 3].includes(body.level) && ['a', 'b'].includes(body.team)) g.receiveHype({ id: 'practice-train', team: body.team, kind: body.level ? 'begin' : 'end', level: body.level, expiresAt: Date.now() + 90000, startedAt: Date.now() }, true);
                        else if (body.action === 'gift' && [1, 10].includes(body.total) && ['a', 'b'].includes(body.team)) g.receiveGift({ id: opaque(), team: body.team, name: 'Test gifter', total: body.total, at: Date.now() }, true);
                        else throw new Error('Practice uses free sample caves.');
                        const accountId = browser.account;
                        if (accountId) await service.change(d => { d.accounts[accountId]!.practice = g.checkpoint(); d.accounts[accountId]!.practiceProfiles = g.store.profiles; });
                    } else {
                        if (!browser.account) throw new Error('Sign in with Twitch.');
                        if (body.action === 'cave-generate') {
                            const current = service.payload(browser.account);
                            if (body.sessionId !== current.state.id || (body.team && body.team !== current.account!.team)) throw new Error('Create caves from your own camp. Refresh and try again.');
                            if (!ai.configured) throw new Error('AI is unavailable. Built-in caves still work.');
                            if (storage.read().usage.requests >= ai.maxRequests) throw new Error('AI cap reached. Built-in caves still work.');
                            const job = await service.prepareGeneration(browser.account, body.retry === true), controller = new AbortController(); pendingJobs.add(controller);
                            const work = caveCreator(ai)(job.batch, controller.signal).then(cave => service.completeGeneration(job, cave), error => service.completeGeneration(job, undefined, error.message)).catch(interrupted).finally(() => { pendingJobs.delete(controller); jobPromises.delete(work); });
                            jobPromises.add(work);
                        } else await service.action(browser.account, body);
                    }
                    broadcast(); return json(res, 200, payload(browser));
                }
                if (!browser.account) return json(res, 401, { error: 'Sign in with Twitch.' });
                if (url.pathname === '/api/invites') { const token = await service.invite(browser.account); return json(res, 200, { url: `${baseUrl}/?invite=${token}#setup` }); }
                if (url.pathname === '/api/invites/accept') { await service.accept(browser.account, String(body.token)); browser.practice = false; return json(res, 200, payload(browser)); }
                if (url.pathname === '/api/partner/leave') { await service.leave(browser.account); return json(res, 200, payload(browser)); }
                if (url.pathname === '/api/twitch/disconnect') {
                    connections.get(browser.account)?.close(); connections.delete(browser.account);
                    const accountId = browser.account;
                    await service.change(d => { delete d.accounts[accountId]!.credentials; }); return json(res, 200, { ok: true });
                }
                if (url.pathname === '/api/admin/ai') {
                    if (!operators.has(browser.account)) return json(res, 403, { error: 'Operator access required.' });
                    await service.change(d => { const a = Object.values(d.accounts).find(a => a.login === body.login); if (!a || typeof body.enabled !== 'boolean') throw new Error('Choose a registered streamer and AI access.'); a.aiEnabled = body.enabled; });
                    return json(res, 200, { ok: true });
                }
                return json(res, 404, { error: 'Unknown endpoint.' });
            }
            if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
            if (url.pathname === '/api/invites') return json(res, 200, service.invitation(url.searchParams.get('token') || ''));
            if (url.pathname === '/api/admin') {
                if (!browser?.account || !operators.has(browser.account)) return json(res, 403, { error: 'Operator access required.' });
                const d = storage.read(); return json(res, 200, { accounts: Object.values(d.accounts).map(a => ({ login: a.login, enabled: a.aiEnabled })), usage: d.usage,
                    budget: { total: 100, hostingMonthlyEstimate: Number(env.HOSTING_MONTHLY_ESTIMATE_USD || 0) || null, aiCost: null, note: 'Token counts are measured. Confirm dollar charges in provider billing.' } });
            }
            if (url.pathname === '/auth/twitch') {
                if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) throw new Error('Twitch signup is not configured yet. Try a practice climb.');
                if (!browser) { const token = opaque(); key = digest(token); browser = { expires: Date.now() + 3600000, practice: true }; browsers.set(key, browser); setCookie(res, token); }
                const state = opaque(); await service.change(d => { d.oauth[digest(state)] = { browser: key, expires: Date.now() + 600000 }; });
                const target = new URL('https://id.twitch.tv/oauth2/authorize');
                target.search = new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, redirect_uri: `${baseUrl}/auth/twitch/callback`, response_type: 'code', scope: 'user:read:chat channel:read:hype_train channel:read:subscriptions', state }).toString();
                res.writeHead(303, { Location: target.href }); return res.end();
            }
            if (url.pathname === '/auth/twitch/callback') {
                const state = digest(url.searchParams.get('state') || '');
                await service.change(d => { const p = d.oauth[state]; if (!p || p.browser !== key || p.expires < Date.now()) throw new Error('Sign-in expired. Try again.'); delete d.oauth[state]; });
                if (url.searchParams.has('error')) throw new Error('Twitch sign-in was cancelled. Try again.');
                const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', signal: AbortSignal.timeout(10000), body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID!, client_secret: env.TWITCH_CLIENT_SECRET!, code: url.searchParams.get('code') || '', grant_type: 'authorization_code', redirect_uri: `${baseUrl}/auth/twitch/callback` }) });
                if (!tokenResponse.ok) throw new Error('Twitch sign-in failed. Try again.');
                const tokens = await tokenResponse.json() as Credentials;
                const validated = await fetch('https://id.twitch.tv/oauth2/validate', { signal: AbortSignal.timeout(10000), headers: { Authorization: `OAuth ${tokens.access_token}` } });
                if (!validated.ok) throw new Error('Twitch could not verify your account.');
                const identity = await validated.json() as any;
                if (identity.client_id !== env.TWITCH_CLIENT_ID || !identity.scopes?.includes('user:read:chat')) throw new Error('Twitch chat permission is required. Try signing in again.');
                const id = await service.signup({ ...tokens, id: identity.user_id, login: identity.login, expiresAt: Date.now() + identity.expires_in * 1000 });
                const token = opaque(), nextKey = digest(token), expires = Date.now() + 86400000;
                await service.change(d => { delete d.sessions[key]; d.sessions[nextKey] = { account: id, expires }; });
                browsers.delete(key); browsers.set(nextKey, { account: id, expires, practice: false }); setCookie(res, token);
                background(connect(id)); res.writeHead(303, { Location: '/#setup' }); return res.end();
            }
            if (url.pathname === '/api/state' || url.pathname === '/api/events') {
                const overlay = url.searchParams.get('channel') || undefined;
                if (!overlay && !browser) return json(res, 401, { error: 'Start a practice climb or sign in.' });
                const value = overlay ? overlayPayload(overlay) : url.searchParams.has('practice') ? { state: practice(browser!).snapshot(), now: Date.now(), healthy } : payload(browser!);
                if (url.pathname === '/api/state') return json(res, 200, value);
                if ([...streams.values()].filter(s => overlay ? s.overlay === overlay : s.key === key).length >= 8) return json(res, 429, { error: 'Too many preview windows. Close one and reconnect.' });
                res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
                res.write(`data: ${JSON.stringify(value)}\n\n`); streams.set(res, { key: browser ? key : undefined, overlay, practice: url.searchParams.has('practice') }); req.on('close', () => streams.delete(res)); return;
            }
            if (url.pathname === '/api/config') return json(res, 200, { hosted: true, twitch: Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) });
            const pathname = url.pathname === '/' ? '/index.html' : url.pathname === '/overlay' ? '/overlay.html' : url.pathname;
            const path = resolve(publicRoot, `.${decodeURIComponent(pathname)}`);
            if (!path.startsWith(publicRoot + '/')) return json(res, 403, { error: 'Forbidden.' });
            try { const file = await readFile(path); res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(file); }
            catch { json(res, 404, { error: 'Page not found.' }); }
        } catch (error) {
            if (res.headersSent) { res.end(); return; }
            const message = error instanceof Error ? error.message : 'Request failed.';
            if (req.url?.startsWith('/auth/')) {
                res.writeHead(400, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
                res.end('<!doctype html><meta name="viewport" content="width=device-width"><title>Sign-in interrupted</title><link rel="stylesheet" href="/excavation.css"><main><h1>Sign-in interrupted.</h1><p>Twitch could not complete sign-in. Your camp is saved.</p><a href="/#setup">Back to setup</a> · <a href="/auth/twitch">Try again</a></main>'); return;
            }
            // Database/crypto errors must never expose server configuration.
            json(res, 400, { error: /password|postgres|certificate|connect |cipher|decrypt|ECONN|relation|syntax error/i.test(message) ? 'The server could not save this action. Try again shortly.' : message });
        }
    });
    const timer = setInterval(() => {
        // A stalled database must not leave /health green indefinitely.
        if (!stopping && healthy && Date.now() - lastTickAt >= 10000) interrupted();
        if (ticking || stopping || !healthy) return; ticking = true;
        void service.tick().then(() => {
            lastTickAt = Date.now();
            for (const [key, b] of browsers) { if (b.expires < Date.now()) browsers.delete(key); else b.game?.tick(); }
            for (const [key, limit] of limits) if (limit.until < Date.now()) limits.delete(key);
            broadcast();
        }).catch(interrupted).finally(() => { ticking = false; });
    }, 500); timer.unref();
    for (const account of Object.values(storage.read().accounts)) if (account.credentials) background(connect(account.id));
    async function close() {
        stopping = true; clearInterval(timer); for (const c of connections.values()) c.close(); for (const job of pendingJobs) job.abort();
        await Promise.allSettled(jobPromises);
        await service.change(d => { for (const b of browsers.values()) if (b.account && b.game) { d.accounts[b.account]!.practice = b.game.checkpoint(); d.accounts[b.account]!.practiceProfiles = b.game.store.profiles; } }).catch(() => {});
        for (const res of streams.keys()) res.end(); server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve())); await storage.close();
    }
    return { server, service, storage, ai, port, host, close, connect };
}
