import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AIProvider } from './src/ai.ts';
import { caveCreator } from './src/expedition-caves.ts';
import { Expedition } from './src/expedition.ts';
import { ProfileStore } from './src/expedition-store.ts';
import { TwitchConnections } from './src/twitch.ts';
import { TEAM_IDS } from './src/types.ts';
import type { TeamId } from './src/types.ts';
const root = dirname(fileURLToPath(import.meta.url));
const mime: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookies = (request: IncomingMessage) => Object.fromEntries((request.headers.cookie ?? '').split(';').map(c => c.trim().split('=')));
const loopback = (host: string) => ['127.0.0.1', 'localhost', '::1'].includes(host);
export function createApp(env: NodeJS.ProcessEnv = process.env) {
    const port = Number(env.PORT || 4177);
    const host = env.HOST || '127.0.0.1';
    const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
    const expectedOrigin = new URL(baseUrl).origin;
    const controlToken = env.CONTROL_TOKEN || '';
    if (!loopback(host) && controlToken.length < 20)
        throw new Error('Remote hosting requires a CONTROL_TOKEN of at least 20 characters.');
    const sessions = new Map<string, number>();
    const viewers = new Set<ServerResponse>();
    const store = new ProfileStore(env.EXPEDITION_STORE === 'memory' ? undefined : join(root, '.runtime', 'expedition-profiles.json'));
    const ai = new AIProvider({ ...env, AI_USAGE_FILE: env.AI_USAGE_FILE || (env.EXPEDITION_STORE === 'memory' ? '' : join(root, '.runtime', 'ai-usage.json')) });
    const game = new Expedition({ store, caveCreator: caveCreator(ai) });
    const twitch = new TwitchConnections({ baseUrl, onMessage: message => game.ingest(message), onStatus: (...args) => game.setConnection(...args), onHype: event => game.receiveHype(event), onHypeStatus: (team, available) => game.setHypeAvailable(team, available), onGift: event => game.receiveGift(event), onGiftStatus: (team, available) => game.setGiftsAvailable(team, available) }, env);
    let lastBroadcast = 0;
    const payload = () => ({ state: game.snapshot(), now: Date.now(), capabilities: { twitch: twitch.configured, aiRequests: ai.requests, ai: ai.status() } });
    const broadcast = () => {
        const value = `data: ${JSON.stringify(payload())}\n\n`;
        for (const viewer of viewers) {
            if (viewer.writableLength > 512000) {
                viewer.end();
                viewers.delete(viewer);
            }
            else
                viewer.write(value);
        }
        lastBroadcast = Date.now();
    };
    game.onChange = broadcast;
    const timer = setInterval(() => { game.tick(); if (Date.now() - lastBroadcast > 1000)
        broadcast(); }, 200);
    timer.unref();
    const authenticated = (req: IncomingMessage) => (sessions.get(cookies(req).scrawl_session) ?? 0) > Date.now();
    const json = (res: ServerResponse, code: number, value: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    const readBody = async (req: IncomingMessage) => {
        let raw = '';
        for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 16384)
                throw new Error('Request too large.');
        }
        return raw ? JSON.parse(raw) : {};
    };
    const teamId = (value: unknown): TeamId => { if (!TEAM_IDS.includes(value as TeamId))
        throw new Error('Choose team a or b.'); return value as TeamId; };
    const server = createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
        try {
            const url = new URL(req.url ?? '/', baseUrl);
            // Bound local control to this host and reject cross-origin mutation, including DNS rebinding.
            const allowedHosts = new Set([new URL(baseUrl).host, `127.0.0.1:${port}`, `localhost:${port}`]);
            if (!allowedHosts.has(req.headers.host ?? ''))
                return json(res, 403, { error: 'Unexpected host.' });
            if (req.method === 'POST') {
                if (!req.headers.origin || ![expectedOrigin, `http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin))
                    return json(res, 403, { error: 'Unexpected origin.' });
                const body = await readBody(req);
                if (url.pathname === '/api/session') {
                    const local = loopback(host) && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
                    if (!local && (!controlToken || typeof body.token !== 'string' || !equal(body.token, controlToken)))
                        return json(res, 401, { error: 'Enter the host control token.' });
                    for (const [id, expires] of sessions)
                        if (expires < Date.now())
                            sessions.delete(id);
                    const session = randomBytes(24).toString('hex');
                    sessions.set(session, Date.now() + 24 * 60 * 60 * 1000);
                    res.setHeader('Set-Cookie', `scrawl_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${expectedOrigin.startsWith('https:') ? '; Secure' : ''}`);
                    return json(res, 200, { authenticated: true });
                }
                if (!authenticated(req))
                    return json(res, 401, { error: 'Host access is required.' });
                if (url.pathname === '/api/action') {
                    let feedback: string | undefined;
                    if (body.sessionId !== game.id)
                        throw new Error('The session has changed. Refresh and try again.');
                    if (body.action === 'demo')
                        game.setMode('demo');
                    else if (body.action === 'live')
                        game.setMode('live');
                    else if (body.action === 'settings')
                        game.configure(body.settings ?? {});
                    else if (body.action === 'cave-ideas')
                        game.prepareCave(teamId(body.team), body.ideas);
                    else if (body.action === 'cave-generate') {
                        if (!ai.configured) throw new Error('Add OPENAI_API_KEY to the server .env, then restart.');
                        if (ai.requests >= ai.maxRequests) throw new Error('AI request cap reached. Existing caves and normal climbs still work.');
                        game.generateCave(teamId(body.team), body.retry === true);
                    }
                    else if (body.action === 'save')
                        game.retrySave();
                    else {
                        if (game.mode !== 'demo')
                            throw new Error('Demo controls are disabled in live mode. Viewers use Twitch chat.');
                        if (body.action === 'dig')
                            game.dig(String(body.playerId));
                        else if (body.action === 'rescue-practice')
                            game.startRescuePractice();
                        else if (body.action === 'choose')
                            game.choose(String(body.playerId), String(body.runId), String(body.choice));
                        else if (body.action === 'equip')
                            game.equip(String(body.playerId), body.item);
                        else if (body.action === 'gift') {
                            if (game.practice && !game.practice.done) throw new Error('Finish rescue practice before testing gifts.');
                            const total = Number(body.total);
                            if (![1, 10].includes(total)) throw new Error('Choose 1 or 10 simulated gifts.');
                            feedback = game.receiveGift({ id: randomBytes(16).toString('hex'), team: teamId(body.team), name: 'Test gifter', total, at: Date.now() }, true);
                        }
                        else if (body.action === 'hype') {
                            if (game.practice && !game.practice.done) throw new Error('Finish rescue practice before testing Hype.');
                            const team = teamId(body.team);
                            const level = Number(body.level);
                            if (![0, 1, 3].includes(level))
                                throw new Error('Choose off, 2×, or 3×.');
                            let current = game.hype[team];
                            if (current && level > 0 && level < current.level) {
                                game.receiveHype({ ...current, kind: 'end' }, true);
                                current = undefined;
                            }
                            game.receiveHype({ id: current?.id ?? `demo-${randomBytes(8).toString('hex')}`, team, kind: level === 0 ? 'end' : current ? 'progress' : 'begin', level, expiresAt: Date.now() + 90000, startedAt: current?.startedAt ?? Date.now() }, true);
                        }
                        else
                            throw new Error('Unknown action.');
                    }
                    return json(res, 200, { ...payload(), feedback });
                }
                if (url.pathname === '/api/twitch/connect')
                    return json(res, 200, { url: twitch.authorize(teamId(body.team), cookies(req).scrawl_session) });
                if (url.pathname === '/api/twitch/disconnect') {
                    twitch.disconnect(teamId(body.team));
                    return json(res, 200, { disconnected: true });
                }
                return json(res, 404, { error: 'Unknown endpoint.' });
            }
            if (req.method !== 'GET')
                return json(res, 405, { error: 'Method not allowed.' });
            if (url.pathname === '/health')
                return json(res, 200, { ok: true, project: 'scrawl', game: 'excavation' });
            if (url.pathname === '/api/state')
                return json(res, 200, { ...payload(), authenticated: authenticated(req) });
            if (url.pathname === '/api/events') {
                res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
                res.write(`data: ${JSON.stringify(payload())}\n\n`);
                viewers.add(res);
                req.on('close', () => viewers.delete(res));
                return;
            }
            if (url.pathname === '/auth/twitch/callback') {
                if (!authenticated(req))
                    throw new Error('Sign in to the host dashboard before connecting Twitch.');
                if (url.searchParams.has('error'))
                    throw new Error('Twitch authorization was cancelled.');
                await twitch.complete(url.searchParams.get('code') ?? '', url.searchParams.get('state') ?? '', cookies(req).scrawl_session);
                res.writeHead(303, { Location: '/#setup' });
                return res.end();
            }
            const pathname = url.pathname === '/' ? '/index.html' : url.pathname === '/overlay' ? '/overlay.html' : url.pathname;
            const path = resolve(join(root, 'public'), `.${decodeURIComponent(pathname)}`);
            if (!path.startsWith(`${join(root, 'public')}/`))
                return json(res, 403, { error: 'Forbidden.' });
            try {
                const file = await readFile(path);
                res.writeHead(200, { 'Content-Type': `${mime[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' });
                res.end(file);
            }
            catch {
                return json(res, 404, { error: 'Page not found.' });
            }
        }
        catch (error) {
            json(res, 400, { error: error instanceof Error ? error.message : 'Request failed.' });
        }
    });
    const close = async () => { clearInterval(timer); game.caves.reset(); game.retrySave(); twitch.close(); for (const res of viewers)
        res.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); };
    return { server, game, ai, twitch, port, host, close };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const app = process.env.DATABASE_URL ? await (await import('./src/hosted-server.ts')).createHostedApp() : createApp();
    app.server.listen(app.port, app.host, () => console.log(`Excavation ready: ${process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${app.port}`}\n${process.env.DATABASE_URL ? 'Hosted camps with Postgres' : 'Local rehearsal'} · AI caves: ${app.ai.configured ? 'ready (host starts requests)' : 'not configured'}`));
    for (const signal of ['SIGINT', 'SIGTERM'])
        process.on(signal, () => { void app.close().then(() => process.exit(0)); });
}
