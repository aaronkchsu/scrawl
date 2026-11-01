import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { MemoryHostedStore, PostgresHostedStore } from '../src/hosted-store.ts';
import { TokenVault, digest } from '../src/hosted-auth.ts';
import { HostedGame } from '../src/hosted-game.ts';
import { createHostedApp } from '../src/hosted-server.ts';
const key = 'a-test-only-key-with-at-least-thirty-two-characters';
const credentials = (n: number) => ({ id: String(n), login: `channel${n}`, access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 3600, expiresAt: Date.now() + 3600000 });
function fixture(max = 10) { let now = Date.now(); const store = new MemoryHostedStore(); const game = new HostedGame(store, new TokenVault(key), max, () => now); return { store, game, advance: (n: number) => now += n }; }
async function account(game: HostedGame, n: number, open = true) {
    await game.signup(credentials(n));
    await game.channel(String(n), (g, t) => g.setConnection(t, `channel${n}`, 'connected', 'Connected'));
    if (open) await game.action(String(n), { action: 'live', sessionId: game.payload(String(n)).state.id });
}
const command = (game: HostedGame, id: string, viewer: string, text: string, delivery: string) => game.ingest(id, { id: delivery, team: 'a', userId: viewer, source: 'twitch', name: `viewer${viewer}`, text });

test('ordinary chat bypasses saves while game commands remain deduplicated and channel-owned', async (t) => {
    const { game, store } = fixture(); await account(game, 1); await account(game, 2);
    const writes = t.mock.method(store, 'transaction');
    await Promise.all(Array.from({ length: 2000 }, (_, i) => command(game, '1', '91', ['hello', 'wow!', '!digging', '!joiner'][i % 4]!, `chat${i}`)));
    assert.equal(writes.mock.callCount(), 0); assert.equal(Object.keys(store.read().deliveries).length, 0);
    await command(game, '1', '91', '  !JOIN  ', 'join');
    await command(game, '1', '91', '!dig', 'dig'); await command(game, '1', '91', '!dig', 'dig');
    assert.equal(game.payload('1').state.runs.length, 1); assert.equal(game.payload('2').state.players.length, 0);
    assert.equal(Object.keys(store.read().deliveries).length, 2);
});

test('selected reads and room payloads cannot mutate committed progress or expose another camp', async () => {
    const { game, store } = fixture(); await account(game, 1); await account(game, 2);
    await command(game, '1', '91', '!join', 'j1'); await command(game, '2', '92', '!join', 'j2');
    const selected = store.read(d => d.profiles['twitch:91']!); selected.xp = 999;
    const payload = game.payload('1'); payload.state.players[0]!.xp = 888;
    assert.equal(game.payload('1').state.players[0]!.xp, 0);
    assert.doesNotMatch(JSON.stringify(game.payload('1', true)), /viewer92|access-2|refresh-2/);
    await assert.rejects(store.transaction(d => { d.profiles['twitch:91']!.xp = 777; throw Error('rollback'); }));
    assert.equal(store.read(d => d.profiles['twitch:91']!.xp), 0);
});

test('encrypted credentials are authenticated and never appear in host or overlay snapshots', async () => {
    const { game, store } = fixture(); await account(game, 1);
    const sealed = store.read().accounts['1']!.credentials!;
    assert.ok(!sealed.includes('access-1')); assert.equal(new TokenVault(key).open<any>(sealed).access_token, 'access-1');
    assert.throws(() => new TokenVault('a-different-long-secret-for-test-purposes').open(sealed));
    assert.throws(() => new TokenVault('short'));
    for (const overlay of [true, false]) { const snapshot = JSON.stringify(game.payload('1', overlay)); assert.doesNotMatch(snapshot, /access-1|refresh-1|credentials|practiceProfiles/); }
    assert.equal('account' in game.payload('1', true), false);
});

test('pairing is one use, preserves queues and stable OBS IDs, excludes a third camp, and freezes shared rules', async () => {
    const { game, store } = fixture(); for (const n of [1, 2, 3]) await account(game, n);
    for (const n of [1, 2]) {
        await game.action(String(n), { action: 'pause', sessionId: game.payload(String(n)).state.id });
        await command(game, String(n), String(n + 100), '!join', `join${n}`);
        await command(game, String(n), String(n + 100), '!dig', `dig${n}`);
    }
    const links = [1, 2, 3].map(n => game.payload(String(n)).account!.overlay);
    const invite = await game.invite('1'); await game.accept('2', invite);
    assert.equal(game.payload('1').state.queue.length, 2); assert.equal(game.payload('3').state.players.length, 0);
    assert.equal(game.payload('2').account!.team, 'b');
    await assert.rejects(game.accept('3', invite), /invalid|expired/);
    await assert.rejects(game.action('2', { action: 'settings', sessionId: game.payload('2').state.id, settings: { slots: 1 } }), /fixed/);
    await game.action('2', { action: 'settings', sessionId: game.payload('2').state.id, settings: { giftRocks: true } });
    assert.equal(store.read().accounts['1']!.settings.giftRocks, false);
    await game.leave('2');
    assert.equal(game.payload('1').state.queue.length, 1); assert.equal(game.payload('2').state.queue.length, 1);
    assert.deepEqual([1, 2, 3].map(n => game.payload(String(n)).account!.overlay), links);
});

test('invites expire, active climbs cannot link, and capacity leaves free practice available', async () => {
    const { game, advance } = fixture(1); await account(game, 1); await account(game, 2, false);
    await assert.rejects(game.action('2', { action: 'live', sessionId: game.payload('2').state.id }), /busy/);
    const invite = await game.invite('1'); advance(86400001); assert.throws(() => game.invitation(invite), /expired/);
    const next = await game.invite('1'); await command(game, '1', '91', '!join', 'j'); await command(game, '1', '91', '!dig', 'd');
    await assert.rejects(game.accept('2', next), /current climbs/);
});

test('restarts preserve climbs without downtime hazards, deduplicate deliveries and bank simultaneous rewards once', async () => {
    const f = fixture(); for (const n of [1, 2]) await account(f.game, n);
    for (const n of [1, 2]) { await command(f.game, String(n), '92', '!join', `j${n}`); await command(f.game, String(n), '92', '!dig', `d${n}`); }
    const before = f.game.payload('1').state.runs[0]!; f.advance(600000); await f.game.reconnect();
    await f.game.tick(); const after = f.game.payload('1').state.runs[0]!;
    assert.equal(after.floor, before.floor); assert.equal(after.hp, before.hp); assert.equal(after.nextAt! - before.nextAt!, 600000);
    await command(f.game, '1', '92', '!dig', 'd1'); assert.equal(f.game.payload('1').state.runs.length, 1);
    for (const n of [1, 2]) await f.game.channel(String(n), g => { const r = g.runs[0]!; r.phase = 'choice'; r.loot = 15; r.item = 'shield'; });
    await Promise.all([1, 2].map(n => f.game.channel(String(n), g => g.choose('twitch:92', g.runs[0]!.id, 'keep'), `keep${n}`)));
    assert.equal(f.store.read().profiles['twitch:92']!.ore, 30);
    await f.game.channel('1', g => g.choose('twitch:92', g.runs[0]!.id, 'keep'), 'keep1');
    assert.equal(f.store.read().profiles['twitch:92']!.ore, 30);
    assert.equal(f.store.read().profiles['twitch:92']!.inventory.filter(x => x === 'shield').length, 1);
});

test('Postgres commits atomically, rolls back failed saves, and hands off the lease without duplicate writers', async () => {
    const pg = new PGlite(); const client = { query: (sql: string, values?: any[]) => pg.query(sql, values) };
    const a = new PostgresHostedStore(client, async () => {}), b = new PostgresHostedStore(client, async () => {});
    try {
        await a.initialize(); await assert.rejects(b.initialize(), /Another game server/);
        await a.transaction(d => { d.usage.requests = 13; });
        await assert.rejects(a.transaction(d => { d.usage.requests = 50; throw Error('save failed'); }), /save failed/);
        assert.equal(a.read().usage.requests, 13);
        await b.requestHandoff(); await assert.rejects(a.transaction(d => { d.usage.requests++; }), /handing over/);
        await b.initialize(); assert.equal(b.read().usage.requests, 13);
        await assert.rejects(a.transaction(d => { d.usage.requests++; }), /lease lost/);
        await b.transaction(d => { d.usage.requests++; }); await a.close();
        await b.transaction(d => { d.usage.requests++; }); assert.equal(b.read().usage.requests, 15);
        await b.close();
    } finally { await pg.close(); }
});

test('HTTP enforces sessions, origins, room ownership, read-only OBS, and free practice isolation', async () => {
    const port = 44000 + Math.floor(Math.random() * 500), url = `http://127.0.0.1:${port}`;
    const store = new MemoryHostedStore(), app = await createHostedApp({ PORT: String(port), BASE_URL: url, TOKEN_ENCRYPTION_KEY: key, AI_INITIAL_REQUESTS: '13', AI_MAX_REQUESTS: '14' }, store);
    await new Promise<void>(r => app.server.listen(port, '127.0.0.1', r));
    const post = (path: string, body: unknown = {}, cookie = '', origin = url) => fetch(url + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        assert.equal((await post('/api/action', { action: 'live' })).status, 401);
        const a = await post('/api/session'), ac = a.headers.get('set-cookie')!.split(';')[0]!, av = await a.json() as any;
        const b = await post('/api/session'), bc = b.headers.get('set-cookie')!.split(';')[0]!;
        assert.equal((await post('/api/action', { action: 'dig', sessionId: av.state.id, playerId: av.state.players[0].id }, ac)).status, 200);
        const bv = await (await fetch(url + '/api/state', { headers: { Cookie: bc } })).json() as any;
        assert.equal(bv.state.runs.length, 0);
        assert.equal((await post('/api/action', { action: 'live', account: '1' }, ac)).status, 400);
        assert.equal((await post('/api/action', {}, ac, 'https://other.example')).status, 403);
        assert.equal((await post('/api/action', { action: 'cave-generate', sessionId: av.state.id }, ac)).status, 400);
        await account(app.service, 1); await account(app.service, 2);
        const channel = app.service.payload('1').account!.overlay;
        const publicState = await (await fetch(url + '/api/state?channel=' + channel)).json() as any;
        assert.equal(publicState.account, undefined); assert.equal(publicState.capabilities, undefined);
        assert.equal((await post('/api/action?channel=' + channel, { action: 'pause', sessionId: publicState.state.id })).status, 401);
        await app.service.change(d => { d.sessions[digest('test-session')] = { account: '1', expires: Date.now() + 10000 }; });
        const forged = await post('/api/action', { action: 'settings', sessionId: app.service.payload('2').state.id, account: '2', settings: { giftRocks: true } }, 'scrawl_session=test-session');
        assert.equal(forged.status, 400); assert.equal(app.service.payload('2').state.settings.giftRocks, false);
        assert.equal((await post('/api/admin/ai', { login: 'channel1', enabled: true }, 'scrawl_session=test-session')).status, 403);
        assert.equal(store.read().usage.requests, 13);
        const sse = await fetch(url + '/api/events?channel=' + channel, { signal: AbortSignal.timeout(2000) });
        const reader = sse.body!.getReader(); const first = new TextDecoder().decode((await reader.read()).value); await reader.cancel();
        assert.ok(first.includes(publicState.state.id)); assert.ok(!first.includes('access-1'));
    } finally { await app.close(); }
});

test('ten rooms with 100 simulated live participants each remain isolated under queued load', async () => {
    const { game, store } = fixture(); const start = performance.now();
    for (let n = 1; n <= 10; n++) {
        await account(game, n);
        await game.channel(String(n), (g, team) => { g.paused = true; for (let v = 0; v < 100; v++) { const p = g.join(`twitch:${n * 1000 + v}`, `viewer${v}`, team); g.dig(p.id); } });
    }
    for (let n = 1; n <= 10; n++) { const p = game.payload(String(n)); assert.equal(p.state.players.length, 100); assert.equal(p.state.queue.length, 100); }
    const tickStart = performance.now(); await game.tick(); const tickMs = performance.now() - tickStart;
    assert.equal(Object.keys(store.read().profiles).length, 1000);
    console.log(`Hosted load: 10 rooms / 1,000 participants; setup ${Math.round(performance.now() - start)}ms; tick ${Math.round(tickMs)}ms.`);
    assert.ok(tickMs < 500, 'A simulation tick should finish before the next 500ms tick.');
});

test('OAuth binds one-use state to the browser, validates Twitch identity, and rotates the session', async (t) => {
    const originalFetch = globalThis.fetch, socket = globalThis.WebSocket;
    globalThis.WebSocket = class { addEventListener() {} close() {} } as any;
    t.after(() => { globalThis.WebSocket = socket; });
    let exchanges = 0;
    t.mock.method(globalThis, 'fetch', (url: any, options?: any) => {
        if (String(url).startsWith('http://127.0.0.1:')) return originalFetch(url, options);
        if (String(url).endsWith('/token')) { exchanges++; return Promise.resolve(Response.json({ access_token: 'test-secret-access', refresh_token: 'test-secret-refresh', expires_in: 7200 })); }
        return Promise.resolve(Response.json({ user_id: '42', login: 'realidentity', client_id: 'client', scopes: ['user:read:chat'], expires_in: 7200 }));
    });
    const port = 45000 + Math.floor(Math.random() * 500), base = `http://127.0.0.1:${port}`;
    const app = await createHostedApp({ BASE_URL: base, TOKEN_ENCRYPTION_KEY: key, TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'test-only' }, new MemoryHostedStore());
    await new Promise<void>(r => app.server.listen(port, '127.0.0.1', r));
    try {
        const start = await fetch(base + '/auth/twitch', { redirect: 'manual' });
        const browserCookie = start.headers.get('set-cookie')!.split(';')[0]!;
        const state = new URL(start.headers.get('location')!).searchParams.get('state');
        const callback = base + '/auth/twitch/callback?code=fake&state=' + state;
        const wrong = await fetch(callback, { redirect: 'manual', headers: { Cookie: 'scrawl_session=another-browser' } });
        assert.equal(wrong.status, 400); assert.equal(exchanges, 0);
        const complete = await fetch(callback, { redirect: 'manual', headers: { Cookie: browserCookie } });
        assert.equal(complete.status, 303); assert.equal(exchanges, 1);
        const signedIn = complete.headers.get('set-cookie')!;
        assert.match(signedIn, /HttpOnly; SameSite=Lax/); assert.notEqual(signedIn.split(';')[0], browserCookie);
        const stateResponse = await fetch(base + '/api/state', { headers: { Cookie: signedIn.split(';')[0]! } });
        const current = await stateResponse.json() as any;
        assert.equal(current.account.id, '42'); assert.equal(current.account.login, 'realidentity');
        assert.doesNotMatch(JSON.stringify(current), /test-secret/);
        assert.equal((await fetch(callback, { redirect: 'manual', headers: { Cookie: browserCookie } })).status, 400);
        assert.equal(exchanges, 1);
        assert.equal((await fetch(base + '/api/state', { headers: { Cookie: browserCookie } })).status, 401);
    } finally { await app.close(); }
});

test('Postgres load persists 10 camps and 1,000 viewers without rewriting inventories on idle ticks', async () => {
    const pg = new PGlite(); let entityWrites = 0;
    const db = new PostgresHostedStore({ query: (sql, values) => { if (sql.startsWith('INSERT INTO excavation_entities')) entityWrites++; return pg.query(sql, values); } }, async () => {});
    await db.initialize(); const game = new HostedGame(db, new TokenVault(key));
    try {
        for (let n = 1; n <= 10; n++) {
            await account(game, n); await game.channel(String(n), (g, team) => {
                g.paused = true;
                for (let v = 0; v < 100; v++) { const p = g.join(`twitch:${n * 1000 + v}`, `viewer${v}`, team); g.dig(p.id); }
            });
        }
        const before = entityWrites, start = performance.now(); await game.tick();
        assert.equal(entityWrites, before); console.log(`Postgres 10-room idle tick: ${Math.round(performance.now() - start)}ms, zero inventory writes.`);
        await db.close();
        const restored = new PostgresHostedStore({ query: (sql, values) => pg.query(sql, values) }, async () => {}); await restored.initialize();
        assert.equal(Object.keys(restored.read().profiles).length, 1000); assert.equal(Object.keys(restored.read().rooms).length, 10);
        assert.equal(Object.values(restored.read().rooms).every(r => r.game.queue.length === 100), true);
        await restored.close();
    } finally { await pg.close(); }
});

test('AI allowance is reserved across simultaneous requests and stale generation cannot replace a reset room', async () => {
    const app = await createHostedApp({ BASE_URL: 'http://localhost:4177', TOKEN_ENCRYPTION_KEY: key, AI_INITIAL_REQUESTS: '13', AI_MAX_REQUESTS: '14' }, new MemoryHostedStore());
    try {
        const results = await Promise.allSettled([app.ai.beforeRequest!(), app.ai.beforeRequest!()]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(app.storage.read().usage.requests, 14);
        await account(app.service, 1);
        await app.service.change(d => { d.accounts['1']!.aiEnabled = true; });
        for (const [i, idea] of ['bees', 'moon', 'crystals'].entries()) await command(app.service, '1', String(i + 50), '!idea ' + idea, `idea-${i}`);
        const job = await app.service.prepareGeneration('1', false);
        const original = app.service.payload('1').state.caves.job!.batch;
        await app.service.completeGeneration(job, undefined, 'Temporary failure');
        const retry = await app.service.prepareGeneration('1', true);
        assert.deepEqual(retry.batch.ideas, original.ideas);
        await app.service.change(d => { d.rooms[retry.room]!.game.id = '00000000-0000-4000-8000-000000000001'; });
        await app.service.completeGeneration(retry, undefined, 'late failure');
        assert.equal(app.service.payload('1').state.caves.job!.status, 'drawing');
    } finally { await app.close(); }
});

test('multiple OBS windows share frames without sharing host data, and revoked hosts disconnect', async () => {
    const port = 47000 + Math.floor(Math.random() * 500), base = `http://127.0.0.1:${port}`;
    const app = await createHostedApp({ BASE_URL: base, TOKEN_ENCRYPTION_KEY: key }, new MemoryHostedStore());
    await new Promise<void>(r => app.server.listen(port, '127.0.0.1', r));
    const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
    async function open(path: string, cookie = '') {
        const response = await fetch(base + path, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        const reader = response.body!.getReader(); readers.push(reader);
        const initial = await reader.read(); assert.equal(initial.done, false); return reader;
    }
    const frame = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
        const value = new TextDecoder().decode((await reader.read()).value);
        return JSON.parse(value.split('\n')[0]!.slice(6));
    };
    try {
        await account(app.service, 1); await account(app.service, 2);
        await app.service.change(d => { d.sessions[digest('frame-session')] = { account: '1', expires: Date.now() + 20000 }; });
        const firstId = app.service.payload('1').state.id, secondId = app.service.payload('2').state.id;
        const first = app.service.payload('1').account!.overlay, second = app.service.payload('2').account!.overlay;
        const a = await open('/api/events?channel=' + first), b = await open('/api/events?channel=' + first);
        const other = await open('/api/events?channel=' + second), host = await open('/api/events', 'scrawl_session=frame-session');
        const [av, bv, ov, hv] = await Promise.all([a, b, other, host].map(frame));
        assert.deepEqual(av, bv); assert.equal(av.state.id, firstId); assert.equal(ov.state.id, secondId);
        assert.equal(av.account, undefined); assert.equal(av.capabilities, undefined); assert.equal(hv.account.id, '1');
        await app.service.change(d => { delete d.sessions[digest('frame-session')]; });
        assert.equal((await host.read()).done, true);
        assert.equal((await frame(a)).state.id, firstId);
    } finally { await Promise.allSettled(readers.map(r => r.cancel())); await app.close(); }
});

test('a stalled save marks the server unhealthy and pauses controls instead of reporting success', async (t) => {
    const port = 48000 + Math.floor(Math.random() * 500), base = `http://127.0.0.1:${port}`;
    const app = await createHostedApp({ BASE_URL: base, TOKEN_ENCRYPTION_KEY: key }, new MemoryHostedStore());
    await new Promise<void>(r => app.server.listen(port, '127.0.0.1', r));
    const originalNow = Date.now;
    let release!: () => void, started!: () => void;
    const stalled = new Promise<void>(r => { release = r; }), entered = new Promise<void>(r => { started = r; });
    t.mock.method(app.service, 'tick', () => { started(); return stalled; });
    try {
        const session = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: base } });
        const cookie = session.headers.get('set-cookie')!.split(';')[0]!;
        await entered; t.mock.method(Date, 'now', () => originalNow() + 11000);
        await new Promise(r => setTimeout(r, 550));
        assert.equal((await fetch(base + '/health')).status, 503);
        const action = await fetch(base + '/api/action', { method: 'POST', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'demo' }) });
        assert.equal(action.status, 503); assert.match((await action.json() as any).error, /paused/);
        release();
        assert.equal((await fetch(base + '/health')).status, 503, 'A late save must not revive an interrupted coordinator.');
    } finally { release(); t.mock.restoreAll(); await app.close(); }
});
