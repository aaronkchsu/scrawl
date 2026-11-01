import test from 'node:test';
import assert from 'node:assert/strict';
import { TwitchConnections } from '../src/twitch.ts';
class FakeSocket {
    static latest: FakeSocket;
    listeners = new Map<string, ((event: any) => unknown)[]>();
    constructor(_url: URL) { FakeSocket.latest = this; }
    addEventListener(type: string, listener: (event: any) => unknown) {
        this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]);
    }
    async emit(type: string, data?: unknown) {
        for (const listener of this.listeners.get(type) ?? [])
            await listener({ data: JSON.stringify(data) });
    }
    close() { void this.emit('close'); }
}
test('Twitch subscribes to chat and Hype Train v2, deduplicates Hype and keeps chat when Hype is unavailable', async (t) => {
    const statuses: string[] = [], hype: any[] = [], messages: any[] = [], availability: boolean[] = [], requests: any[] = [];
    const originalSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeSocket as any;
    t.after(() => { globalThis.WebSocket = originalSocket; });
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
        if (url.endsWith('/token'))
            return Response.json({ access_token: 'fake', refresh_token: 'fake', expires_in: 3600 });
        if (url.endsWith('/users'))
            return Response.json({ data: [{ id: '42', login: 'testchannel' }] });
        const body = JSON.parse(String(init.body));
        requests.push(body);
        return new Response('{}', { status: body.type === 'channel.hype_train.end' ? 403 : 202 });
    });
    const twitch = new TwitchConnections({ baseUrl: 'http://localhost', onMessage: m => messages.push(m), onStatus: (_id, _name, status) => statuses.push(status), onHype: e => hype.push(e), onHypeStatus: (_id, ok) => availability.push(ok) }, { TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'fake' });
    try {
        const url = new URL(twitch.authorize('a', 'session'));
        assert.match(url.searchParams.get('scope')!, /channel:read:hype_train/);
        await twitch.complete('code', url.searchParams.get('state')!, 'session');
        const socket = FakeSocket.latest;
        await socket.emit('message', { metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'ws', keepalive_timeout_seconds: 30 } } });
        assert.equal(requests.length, 5);
        assert.deepEqual(requests[4], { type: 'channel.subscription.gift', version: '1', condition: { broadcaster_user_id: '42' }, transport: { method: 'websocket', session_id: 'ws' } });
        assert.equal(requests[0].version, '1');
        assert.ok(requests.slice(1, 4).every(r => r.version === '2' && r.condition.broadcaster_user_id === '42'));
        assert.equal(statuses.at(-1), 'connected');
        assert.equal(availability.at(-1), false);
        const event = { metadata: { message_type: 'notification', message_id: 'hype-1' }, payload: { subscription: { type: 'channel.hype_train.progress' }, event: { id: 'train', level: 3, started_at: '2026-10-30T10:00:00Z', expires_at: '2026-10-30T10:05:00Z' } } };
        await socket.emit('message', event);
        await socket.emit('message', event);
        assert.equal(hype.length, 1);
        assert.equal(hype[0].kind, 'progress');
        assert.equal(hype[0].team, 'a');
        const chat = { metadata: { message_type: 'notification', subscription_type: 'channel.chat.message' }, payload: { event: { message_id: 'chat-1', chatter_user_id: '12', chatter_user_name: 'Viewer', message: { text: '!dig' } } } };
        await socket.emit('message', chat);
        await socket.emit('message', { ...chat, payload: { event: { ...chat.payload.event, source_broadcaster_user_id: 'other' } } });
        assert.equal(messages.length, 1);
        assert.equal(messages[0].userId, '12');
        await socket.emit('message', { metadata: { message_type: 'revocation' }, payload: { subscription: { type: 'channel.hype_train.begin' } } });
        assert.equal(statuses.at(-1), 'connected');
    }
    finally {
        twitch.close();
    }
});
test('disconnect during a pending Twitch subscription cannot revive a stale socket', async (t) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => release = resolve);
    const statuses: string[] = [];
    const originalSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeSocket as any;
    t.after(() => { globalThis.WebSocket = originalSocket; });
    t.mock.method(globalThis, 'fetch', async (url: string) => {
        if (url.endsWith('/token'))
            return Response.json({ access_token: 'fake', refresh_token: 'fake', expires_in: 3600 });
        if (url.endsWith('/users'))
            return Response.json({ data: [{ id: '42', login: 'testchannel' }] });
        await pending;
        return new Response('{}', { status: 202 });
    });
    const twitch = new TwitchConnections({ baseUrl: 'http://localhost', onMessage: () => { }, onStatus: (_id, _name, status) => statuses.push(status) }, { TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'fake' });
    try {
        const url = new URL(twitch.authorize('a', 'session'));
        await twitch.complete('code', url.searchParams.get('state')!, 'session');
        const welcome = FakeSocket.latest.emit('message', { metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'ws' } } });
        twitch.disconnect('a');
        release();
        await welcome;
        assert.equal(statuses.at(-1), 'offline');
        assert.equal(statuses.includes('connected'), false);
    }
    finally {
        twitch.close();
    }
});


test('gift subscriptions preserve anonymity, deduplicate, survive transfer and fail independently of chat', async (t) => {
    const originalSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeSocket as any;
    t.after(() => { globalThis.WebSocket = originalSocket; });
    const gifts: any[] = [], giftStatus: boolean[] = [], statuses: string[] = [], requests: any[] = [];
    let denyGifts = false;
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
        if (url.endsWith('/token')) return Response.json({ access_token: 'fake', refresh_token: 'fake', expires_in: 3600 });
        if (url.endsWith('/users')) return Response.json({ data: [{ id: '42', login: 'testchannel' }] });
        const body = JSON.parse(String(init.body)); requests.push(body);
        return new Response('{}', { status: denyGifts && body.type === 'channel.subscription.gift' ? 403 : 202 });
    });
    const twitch = new TwitchConnections({ baseUrl: 'http://localhost', onMessage: () => {}, onStatus: (_id, _name, status) => statuses.push(status), onGift: event => gifts.push(event), onGiftStatus: (_team, ok) => giftStatus.push(ok) }, { TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'fake' });
    const welcome = { metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'ws' } } };
    try {
        const url = new URL(twitch.authorize('a', 'session'));
        assert.match(url.searchParams.get('scope')!, /channel:read:subscriptions/);
        await twitch.complete('code', url.searchParams.get('state')!, 'session');
        const socket = FakeSocket.latest;
        await socket.emit('message', welcome);
        assert.equal(giftStatus.at(-1), true);
        const notification = { metadata: { message_type: 'notification', message_id: 'gift-1', message_timestamp: '2026-10-30T10:00:00Z' }, payload: { subscription: { type: 'channel.subscription.gift' }, event: { broadcaster_user_id: '42', user_name: 'Hidden', is_anonymous: true, total: 10 } } };
        await socket.emit('message', notification); await socket.emit('message', notification);
        assert.equal(gifts.length, 1);
        assert.deepEqual(gifts[0], { id: 'gift-1', team: 'a', name: 'Anonymous gifter', total: 10, at: Date.parse('2026-10-30T10:00:00Z') });
        await socket.emit('message', { ...notification, metadata: { ...notification.metadata, message_id: 'wrong-channel' }, payload: { ...notification.payload, event: { ...notification.payload.event, broadcaster_user_id: 'other' } } });
        assert.equal(gifts.length, 1);
        await socket.emit('message', { metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?session=transfer' } } });
        const transferred = FakeSocket.latest;
        await transferred.emit('message', welcome);
        assert.equal(requests.length, 5); assert.equal(giftStatus.at(-1), true);
        await socket.emit('message', { ...notification, metadata: { ...notification.metadata, message_id: 'old-socket' } });
        assert.equal(gifts.length, 1);
        await transferred.emit('message', { metadata: { message_type: 'revocation' }, payload: { subscription: { type: 'channel.subscription.gift' } } });
        assert.equal(giftStatus.at(-1), false); assert.equal(statuses.at(-1), 'connected');
        denyGifts = true;
        const reconnect = new URL(twitch.authorize('a', 'session'));
        await twitch.complete('code', reconnect.searchParams.get('state')!, 'session');
        await FakeSocket.latest.emit('message', welcome);
        assert.equal(giftStatus.at(-1), false); assert.equal(statuses.at(-1), 'connected');
    } finally { twitch.close(); }
});

test('hosted startup refresh retries outages without revoking, then validates identity before connecting', async (t) => {
    const socket = globalThis.WebSocket; globalThis.WebSocket = FakeSocket as any;
    t.after(() => { globalThis.WebSocket = socket; });
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let attempts = 0, validations = 0, revoked = 0, saved = 0;
    const twitch = new TwitchConnections({ baseUrl: 'http://localhost', onMessage: () => {}, onStatus: () => {}, onCredentials: async c => { saved++; assert.equal(c.access_token, 'new-access'); }, onRevoked: async () => { revoked++; } }, { TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'fake' });
    t.mock.method(globalThis, 'fetch', async (url: string) => {
        if (url.endsWith('/token')) { attempts++; return attempts === 1 ? new Response('', { status: 503 }) : Response.json({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 7200 }); }
        if (url.endsWith('/validate')) { validations++; return Response.json({ user_id: '42', client_id: 'test', scopes: ['user:read:chat'] }); }
        return new Response('{}', { status: 202 });
    });
    try {
        await twitch.connectCredentials({ id: '42', login: 'testchannel', access_token: 'old', refresh_token: 'old-refresh', expires_in: 1, expiresAt: Date.now() - 1 });
        assert.equal(revoked, 0); assert.equal(validations, 0);
        t.mock.timers.tick(30000); await new Promise(r => setImmediate(r));
        assert.equal(attempts, 2); assert.equal(validations, 1); assert.equal(saved, 1);
        t.mock.timers.tick(3600000); await new Promise(r => setImmediate(r));
        assert.equal(validations, 2); assert.equal(revoked, 0);
    } finally { twitch.close(); }
});

test('hosted validation revokes sessions for wrong identity; transient subscription failures recreate subscriptions', async (t) => {
    const socket = globalThis.WebSocket; globalThis.WebSocket = FakeSocket as any;
    t.after(() => { globalThis.WebSocket = socket; });
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let wrongIdentity = true, revoked = 0, attempts = 0;
    const statuses: string[] = [];
    const twitch = new TwitchConnections({ baseUrl: 'http://localhost', onMessage: () => {}, onStatus: (_t, _n, s) => statuses.push(s), onRevoked: async () => { revoked++; } }, { TWITCH_CLIENT_ID: 'test', TWITCH_CLIENT_SECRET: 'fake' });
    t.mock.method(globalThis, 'fetch', async (url: string) => {
        if (url.endsWith('/validate')) return Response.json({ user_id: wrongIdentity ? '999' : '42', client_id: 'test', scopes: ['user:read:chat'] });
        attempts++; return new Response('{}', { status: attempts === 1 ? 503 : 202 });
    });
    const credentials = { id: '42', login: 'testchannel', access_token: 'a', refresh_token: 'r', expires_in: 7200, expiresAt: Date.now() + 7200000 };
    const welcome = { metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'ws' } } };
    try {
        await twitch.connectCredentials(credentials); assert.equal(revoked, 1);
        wrongIdentity = false; await twitch.connectCredentials(credentials);
        const previous = FakeSocket.latest; await previous.emit('message', welcome);
        assert.equal(statuses.at(-1), 'connecting'); t.mock.timers.tick(1000);
        assert.notEqual(FakeSocket.latest, previous);
        await FakeSocket.latest.emit('message', welcome); assert.equal(statuses.at(-1), 'connected'); assert.equal(attempts, 6);
    } finally { twitch.close(); }
});
