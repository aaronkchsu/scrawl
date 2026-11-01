import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../src/expedition.ts';
import { ROCK_RULES, type GiftEvent } from '../src/expedition-events.ts';
import { routeOutlook } from '../src/expedition-risk.ts';

function setup() {
    let now = 100000, random = .99, count = 0;
    const game = new Expedition({ now: () => now, random: () => random });
    const advance = (ms = 4000) => { now += ms; game.tick(); };
    const gift = (overrides: Partial<GiftEvent> = {}, simulated = true) => game.receiveGift({ id: `gift-${count++}`, team: 'a', name: 'Gifter', total: 1, at: now, ...overrides }, simulated);
    const climb = (id = 'demo:noodle') => { game.dig(id); advance(); advance(); advance(); return game.runs.find(r => r.playerId === id)!; };
    return { game, advance, gift, climb, random: (value: number) => random = value, now: () => now };
}

test('risk odds reflect actual remaining HP, shield, boots and ore multiplier', () => {
    const f = setup(), r = f.climb();
    assert.ok(Math.abs(routeOutlook(r).survivalChance - .71825) < 1e-10);
    r.hp = 2;
    assert.ok(Math.abs(routeOutlook(r).survivalChance - .274625) < 1e-10);
    r.equipped = 'shield';
    assert.ok(Math.abs(routeOutlook(r).survivalChance - .71825) < 1e-10);
    r.shieldUsed = true;
    assert.ok(Math.abs(routeOutlook(r).survivalChance - .274625) < 1e-10);
    r.equipped = 'boots';
    assert.ok(Math.abs(routeOutlook(r).survivalChance - .4225) < 1e-10);
    r.equipped = 'lamp'; r.multiplier = 3;
    assert.equal(routeOutlook(r).summitOre, 15 + (35 + 6) * 3);
    r.hp = 0;
    assert.equal(routeOutlook(r).survivalChance, 0);
    const snapshot = f.game.snapshot();
    assert.equal(snapshot.runs[0]!.outlook.summitOre, 138);
});

test('gift rocks are opt-in for new runs; lower rooms and the keep decision stay safe', () => {
    const f = setup();
    assert.match(f.gift(), /off/);
    const old = f.climb();
    f.game.configure({ giftRocks: true });
    f.game.choose(old.playerId, old.id, 'risk');
    assert.match(f.gift(), /No target/);
    f.game.setMode('demo');
    f.game.dig('demo:noodle');
    assert.match(f.gift(), /No target/);
    f.advance(); f.advance(); f.advance();
    assert.match(f.gift(), /No target/);
    const r = f.game.runs[0]!;
    f.game.choose(r.playerId, r.id, 'keep');
    assert.match(f.gift(), /No target/);
    assert.equal(f.game.players.get(r.playerId)!.ore, 15);
});

test('gift batch warns once, freezes room progress, caps damage, deduplicates and cools down', () => {
    const f = setup();
    f.game.configure({ giftRocks: true });
    const r = f.climb();
    f.game.choose(r.playerId, r.id, 'risk');
    const floor = r.floor, loot = r.loot;
    f.random(0);
    assert.match(f.gift({ id: 'batch', total: 100 }), /100 subs/);
    assert.match(f.gift({ id: 'batch', total: 100 }), /already/);
    assert.match(f.gift(), /cooldown/);
    f.advance(ROCK_RULES.warningMs - 1);
    assert.equal(r.hp, 3);
    assert.equal(r.floor, floor);
    f.advance(1);
    assert.equal(r.hp, 2);
    assert.equal(r.floor, floor);
    assert.equal(r.loot, loot);
    assert.equal(f.game.rocks[0]!.status, 'hit');
    f.game.tick();
    assert.equal(r.hp, 2);
    assert.equal(r.nextAt, f.now() + 4000);
});

test('shield blocks a rock once, boots do not, and a missed rock consumes the one-rock allowance', () => {
    for (const [gear, roll, status, hp] of [['shield', 0, 'blocked', 3], ['boots', 0, 'hit', 2], ['lamp', .99, 'missed', 3]] as const) {
        const f = setup();
        f.game.configure({ giftRocks: true });
        const p = f.game.players.get('demo:noodle')!;
        p.inventory = [gear]; f.game.equip(p.id, gear);
        const r = f.climb(); f.game.choose(p.id, r.id, 'risk');
        f.gift(); f.random(roll); f.advance(8000);
        assert.equal(f.game.rocks[0]!.status, status);
        assert.equal(r.hp, hp);
        assert.equal(r.shieldUsed, gear === 'shield');
        assert.equal(r.rockUsed, true);
        // Hold the route beyond the channel cooldown to prove the per-run cap.
        r.nextAt = null; f.advance(30000);
        assert.match(f.gift(), /No target/);
    }
});

test('fatal rock keeps XP, previous inventory and banked ore; delayed ticks resolve exactly once', () => {
    const f = setup(); f.game.configure({ giftRocks: true });
    const p = f.game.players.get('demo:noodle')!; p.ore = 75; p.inventory = ['crown'];
    const r = f.climb(); r.hp = 1; f.game.choose(p.id, r.id, 'risk');
    f.random(0); f.gift(); f.advance(60000);
    assert.equal(r.phase, 'lost');
    assert.equal(p.ore, 75); assert.equal(p.xp, 45); assert.deepEqual(p.inventory, ['crown']);
    assert.equal(p.climbs, 1); assert.equal(f.game.rocks[0]!.status, 'lost');
    f.advance(6000); assert.equal(p.climbs, 1); assert.equal(f.game.runs.length, 0);
});

test('settings off, disconnect and reset cancel pending damage without late effects', () => {
    for (const cancel of ['settings', 'disconnect', 'reset']) {
        const f = setup(); f.game.configure({ giftRocks: true });
        const r = f.climb(); f.game.choose(r.playerId, r.id, 'risk');
        f.random(0); f.gift();
        if (cancel === 'settings') f.game.configure({ giftRocks: false });
        if (cancel === 'disconnect') f.game.setConnection('a', null, 'offline', 'Disconnected');
        if (cancel === 'reset') f.game.setMode('demo');
        // Stop ordinary room damage so we isolate the cancelled event.
        r.nextAt = null;
        f.advance(10000);
        assert.equal(r.hp, 3);
        assert.ok(f.game.rocks.every(rock => rock.status !== 'warning'));
        if (cancel === 'reset') assert.equal(f.game.runs.length, 0);
        if (cancel === 'settings') {
            f.game.configure({ giftRocks: true });
            f.advance(30000);
            assert.match(f.gift(), /No target/);
        }
    }
});

test('gifts are channel scoped, reject invalid/stale events, and cannot cross demo/live identities', () => {
    const f = setup(); f.game.configure({ giftRocks: true });
    const r = f.climb(); f.game.choose(r.playerId, r.id, 'risk');
    assert.match(f.gift({}, false), /ignored/);
    assert.match(f.gift({ team: 'b' }), /No target/);
    for (const total of [0, -1, 1.5, NaN]) assert.match(f.gift({ total }), /invalid/);
    assert.match(f.gift({ at: 1 }), /earlier session/);
    assert.equal(f.game.rocks.length, 0);
    f.game.setConnection('a', 'channel', 'connected', 'Connected');
    f.game.setMode('live');
    f.game.join('twitch:42', 'Viewer', 'a');
    const live = f.climb('twitch:42'); f.game.choose(live.playerId, live.id, 'risk');
    assert.match(f.gift(), /ignored/);
    assert.match(f.gift({ at: 100001 }, false), /earlier session/);
    assert.match(f.gift({}, false), /rock above/);
    f.game.setMode('demo'); f.advance(20000);
    assert.equal(f.game.rocks.length, 0);
});

test('gift setting defaults off and validation is atomic', () => {
    const f = setup();
    assert.equal(f.game.settings.giftRocks, false);
    assert.throws(() => f.game.configure({ slots: 1, giftRocks: 'true' }));
    assert.equal(f.game.settings.slots, 3);
});
