import test from 'node:test';
import assert from 'node:assert/strict';
// Browser-native module; replace the transport, not the connection logic.
// @ts-ignore browser JavaScript does not need declarations
import { connectState } from '../public/expedition-connection.js';

function transport(t: any, pathname = '/', search = '') {
    class Events {
        static current: Events;
        onmessage?: (event: { data: string }) => void;
        onerror?: () => void;
        closed = false;
        readonly url: string;
        constructor(url: string) { this.url = url; Events.current = this; }
        close() { this.closed = true; }
        send(snapshot: unknown) { this.onmessage?.({ data: JSON.stringify(snapshot) }); }
    }
    for (const [name, value] of Object.entries({ EventSource: Events, location: { pathname, search } })) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, value });
        t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else Reflect.deleteProperty(globalThis, name); });
    }
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw Error('State must come from the ordered event stream.'); });
    const states: any[] = [], connections: boolean[] = [];
    const dispose = connectState((state: any) => states.push(state), (online: boolean) => connections.push(online));
    return { source: Events.current, states, connections, dispose, fetch };
}

test('initial state and updates use one ordered stream without a stale fetch racing them', t => {
    const f = transport(t);
    f.source.send({ state: { floor: 1 } }); f.source.send({ state: { floor: 2 } });
    assert.deepEqual(f.states.map(s => s.state.floor), [1, 2]);
    assert.equal(f.fetch.mock.callCount(), 0);
    assert.deepEqual(f.connections, [true], 'Steady snapshots must not trigger a redundant status render.'); f.dispose();
});

test('an unhealthy snapshot keeps controls disconnected, then a fresh healthy frame recovers', t => {
    const f = transport(t);
    f.source.send({ healthy: false }); f.source.onerror?.(); f.source.send({ healthy: true });
    assert.deepEqual(f.connections, [false, true]); f.dispose();
});

test('disposed streams cannot update a new screen or report a late disconnection', t => {
    const f = transport(t); f.dispose(); f.source.send({ state: {} }); f.source.onerror?.();
    assert.equal(f.source.closed, true); assert.deepEqual(f.states, []); assert.deepEqual(f.connections, []);
});

test('invalid frames disconnect cleanly and the next valid frame recovers', t => {
    const f = transport(t); f.source.onmessage?.({ data: 'invalid JSON' }); f.source.send({ state: {} });
    assert.deepEqual(f.connections, [false, true]); assert.equal(f.states.length, 1); f.dispose();
});

test('OBS preserves its channel identity and strips unrelated URL parameters', t => {
    const f = transport(t, '/overlay', '?channel=test-channel&preview=1&practice=1&unrelated=value');
    assert.equal(f.source.url, '/api/events?channel=test-channel&practice=1'); f.dispose();
});
