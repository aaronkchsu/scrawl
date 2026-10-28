import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Game } from './src/game.ts';
import { AIProvider } from './src/ai.ts';
import { TwitchConnections } from './src/twitch.ts';
import { TEAM_IDS } from './src/types.ts';
import { rehearsalIdeas } from './src/rehearsal.ts';
import { fixtureRounds } from './src/fixtures.ts';
import type { TeamId } from './src/types.ts';

const root = dirname(fileURLToPath(import.meta.url));
const mime: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cookies = (request: IncomingMessage) => Object.fromEntries((request.headers.cookie ?? '').split(';').map(c => c.trim().split('=')));
const loopback = (host: string) => ['127.0.0.1', 'localhost', '::1'].includes(host);

export function createApp(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT || 4177); const host = env.HOST || '127.0.0.1';
  const baseUrl = (env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
  const expectedOrigin = new URL(baseUrl).origin;
  const controlToken = env.CONTROL_TOKEN || '';
  if (!loopback(host) && controlToken.length < 20) throw new Error('Remote hosting requires a CONTROL_TOKEN of at least 20 characters.');
  const sessions = new Map<string, number>(); const viewers = new Set<ServerResponse>();
  const ai = new AIProvider(env); const game = new Game({ creator: input => ai.create(input) });
  const twitch = new TwitchConnections({ baseUrl, onMessage: message => game.ingest(message), onStatus: (...args) => game.setConnection(...args) }, env);
  let lastBroadcast = 0;
  const payload = () => ({ state: game.snapshot(), now: Date.now(), capabilities: { ai: ai.status(), twitch: twitch.configured }, rehearsalPresets: game.state.experience === 'rehearsal' ? fixtureRounds[game.state.round - 1] : undefined });
  const checkDrawingBudget = () => {
    if (game.state.mode !== 'ai') return;
    const needed = TEAM_IDS.filter(id => game.state.teams[id].finalists.length > 0).length;
    const status = ai.status();
    if (status.maxRequests - status.requests < needed) throw new Error(`Drawing needs ${needed} API requests; ${Math.max(0, status.maxRequests - status.requests)} remain. Start a free sample-art rehearsal or update the server request limit.`);
  };
  const broadcast = () => {
    const value = `data: ${JSON.stringify(payload())}\n\n`;
    for (const viewer of viewers) { if (viewer.writableLength > 512_000) { viewer.end(); viewers.delete(viewer); } else viewer.write(value); }
    lastBroadcast = Date.now();
  };
  game.onChange = broadcast;
  const timer = setInterval(() => { game.tick(); if (Date.now() - lastBroadcast > 1000) broadcast(); }, 200); timer.unref();
  const authenticated = (req: IncomingMessage) => (sessions.get(cookies(req).scrawl_session) ?? 0) > Date.now();
  const json = (res: ServerResponse, code: number, value: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const readBody = async (req: IncomingMessage) => {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 16_384) throw new Error('Request too large.'); }
    return raw ? JSON.parse(raw) : {};
  };
  const teamId = (value: unknown): TeamId => { if (!TEAM_IDS.includes(value as TeamId)) throw new Error('Choose team a or b.'); return value as TeamId; };
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
    try {
      const url = new URL(req.url ?? '/', baseUrl);
      // Bound local control to this host and reject cross-origin mutation, including DNS rebinding.
      const allowedHosts = new Set([new URL(baseUrl).host, `127.0.0.1:${port}`, `localhost:${port}`]);
      if (!allowedHosts.has(req.headers.host ?? '')) return json(res, 403, { error: 'Unexpected host.' });
      if (req.method === 'POST') {
        if (!req.headers.origin || ![expectedOrigin, `http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: 'Unexpected origin.' });
        const body = await readBody(req);
        if (url.pathname === '/api/session') {
          const local = loopback(host) && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
          if (!local && (!controlToken || typeof body.token !== 'string' || !equal(body.token, controlToken))) return json(res, 401, { error: 'Enter the host control token.' });
          for (const [id, expires] of sessions) if (expires < Date.now()) sessions.delete(id);
          const session = randomBytes(24).toString('hex'); sessions.set(session, Date.now() + 24 * 60 * 60 * 1000);
          res.setHeader('Set-Cookie', `scrawl_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${expectedOrigin.startsWith('https:') ? '; Secure' : ''}`);
          return json(res, 200, { authenticated: true });
        }
        if (!authenticated(req)) return json(res, 401, { error: 'Host access is required.' });
        if (url.pathname === '/api/rehearsal') {
          if (game.state.experience !== 'rehearsal' || body.matchId !== game.state.id || body.round !== game.state.round) throw new Error('This rehearsal step has changed. Refresh to continue.');
          if (body.action === 'ideas') game.submitRehearsal(rehearsalIdeas(body.ideas, game.state.approaches));
          else if (body.action === 'vote') {
            const result = game.voteRehearsal(teamId(body.team), String(body.finalist));
            if (!result.accepted && result.reason !== 'Your vote is already counted.') throw new Error(result.reason);
          } else if (body.action === 'draw' || body.action === 'retry') {
            const retry = body.action === 'retry';
            if (retry ? game.state.phase !== 'generating' || !game.state.error : game.state.phase !== 'voting') throw new Error('There is no drawing ready to start.');
            if (!retry && TEAM_IDS.some(id => game.state.teams[id].voterCount === 0)) throw new Error('Choose a lead idea for each community first.');
            checkDrawingBudget();
            void game.lock().catch(() => {});
          } else if (body.action === 'fight') game.playRehearsalFight();
          else throw new Error('Unknown rehearsal step.');
          return json(res, 200, payload());
        }
        if (url.pathname === '/api/action') {
          const action = body.action;
          if (action === 'demo') game.start('demo', true);
          else if (action === 'start' || action === 'rehearse') {
            if (body.mode !== 'demo' && body.mode !== 'ai') throw new Error('Choose demo or ai interpretation.');
            if (body.mode === 'ai' && !ai.configured) throw new Error('Live AI needs OPENAI_API_KEY in this project’s .env.');
            if (action === 'start' && TEAM_IDS.some(id => game.state.teams[id].connection !== 'connected')) throw new Error('Connect both Twitch channels before starting a live encounter.');
            game.start(body.mode, false, action === 'rehearse' ? 'rehearsal' : 'live');
          } else if (action === 'pause') game.pause();
          else if (action === 'reset') game.reset();
          else if (action === 'lock' || action === 'retry') {
            if (game.state.experience === 'rehearsal') throw new Error('Use the current rehearsal step.');
            if (game.state.phase === 'building' && action === 'lock') game.openVote();
            else if (game.state.phase === 'voting' || (game.state.phase === 'generating' && game.state.error)) { if (game.state.paused && !game.state.error) throw new Error('Resume before closing the vote.'); checkDrawingBudget(); void game.lock().catch(() => {}); }
            else throw new Error('There is no open nomination or vote to close.');
          }
          else if (action === 'rename') game.rename(teamId(body.team), String(body.name ?? ''));
          else throw new Error('Unknown action.');
          return json(res, 200, payload());
        }
        if (url.pathname === '/api/idea') return json(res, 400, { error: 'Manual input has moved to the rehearsal editor. Live encounters accept Twitch chat only.' });
        if (url.pathname === '/api/twitch/connect') return json(res, 200, { url: twitch.authorize(teamId(body.team), cookies(req).scrawl_session) });
        if (url.pathname === '/api/twitch/disconnect') { twitch.disconnect(teamId(body.team)); return json(res, 200, { disconnected: true }); }
        return json(res, 404, { error: 'Unknown endpoint.' });
      }
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
      if (url.pathname === '/health') return json(res, 200, { ok: true, project: 'scrawl' });
      if (url.pathname === '/api/state') return json(res, 200, { ...payload(), authenticated: authenticated(req) });
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify(payload())}\n\n`); viewers.add(res); req.on('close', () => viewers.delete(res)); return;
      }
      if (url.pathname === '/auth/twitch/callback') {
        if (!authenticated(req)) throw new Error('Sign in to the host dashboard before connecting Twitch.');
        if (url.searchParams.has('error')) throw new Error('Twitch authorization was cancelled.');
        await twitch.complete(url.searchParams.get('code') ?? '', url.searchParams.get('state') ?? '', cookies(req).scrawl_session);
        res.writeHead(303, { Location: '/?connected=1' }); return res.end();
      }
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname === '/overlay' ? '/overlay.html' : url.pathname;
      const path = resolve(join(root, 'public'), `.${decodeURIComponent(pathname)}`);
      if (!path.startsWith(`${join(root, 'public')}/`)) return json(res, 403, { error: 'Forbidden.' });
      try { const file = await readFile(path); res.writeHead(200, { 'Content-Type': `${mime[extname(path)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' }); res.end(file); }
      catch { return json(res, 404, { error: 'Page not found.' }); }
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : 'Request failed.' }); }
  });
  const close = async () => { clearInterval(timer); game.close(); twitch.close(); for (const res of viewers) res.end(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); };
  return { server, game, ai, twitch, port, host, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createApp();
  app.server.listen(app.port, app.host, () => console.log(`SCRAWL local preview: http://localhost:${app.port}\nOffline demo ready. Twitch: ${app.twitch.configured ? 'configured' : 'not configured'} · AI: ${app.ai.configured ? 'configured' : 'not configured'}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
}
