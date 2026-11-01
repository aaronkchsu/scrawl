import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Expedition } from '../src/expedition.ts';
import { ProfileStore } from '../src/expedition-store.ts';
import { RescueLine, RESCUE_RULES } from '../src/expedition-rescue.ts';

function fixture(store = new ProfileStore()) {
    let now = 100000, roll = .99;
    const game = new Expedition({ store, now: () => now, random: () => roll });
    const advance = (ms = 4000) => { now += ms; game.tick(); };
    const cache = (id = 'demo:noodle') => {
        game.dig(id); if (!game.runs.some(r => r.playerId === id)) advance(1500);
        const run = game.runs.find(r => r.playerId === id)!;
        while (run.phase === 'climbing') advance();
        return run;
    };
    return { game, advance, cache, now: () => now, roll: (value: number) => { roll = value; } };
}
const donor = { id: 'demo:one', name: 'One', team: 'a' as const, camp: 'Camp A' };
const recipient = { id: 'demo:two', name: 'Two', team: 'b' as const, camp: 'Camp B' };

test('one incoming rope, 60-second recharge, no stacking or self-rescue, both directions equal', () => {
    const line = new RescueLine();
    const first = line.send(donor, 100000, false)!;
    assert.equal(line.send({ ...donor, id: 'demo:spam' }, 100001, true), null);
    assert.equal(line.ropes.b, first);
    assert.equal(line.catch(recipient, 102999, 15, 0, 4), null);
    assert.equal(line.catch({ ...recipient, id: donor.id }, 103000, 15, 0, 4), null);
    assert.equal(line.catch(recipient, 103000, 15, 0, 4)!.ore, 15);
    assert.equal(line.catch(recipient, 103001, 15, 0, 4), null);
    assert.equal(line.send(donor, 159999, false), null);
    assert.ok(line.send(donor, 160000, false));
    assert.ok(line.send(recipient, 103000, false));
    assert.equal(line.readyAt.b, 163000);
});

test('Keep banks once, sends named help from the run camp, and a fatal summit hit saves existing loot without a crown', () => {
    const f = fixture();
    const a = f.cache();
    // Chatting in the other channel cannot change the climb's origin.
    f.game.join(a.playerId, 'Noodle', 'b');
    f.game.choose(a.playerId, a.id, 'keep');
    assert.equal(f.game.rescueLine.ropes.b!.donor.team, 'a');
    assert.throws(() => f.game.choose(a.playerId, a.id, 'keep'));
    assert.equal(f.game.players.get(a.playerId)!.ore, 15);
    const b = f.cache('demo:mossboss');
    b.floor = 5; b.hp = 2; b.loot = 35; b.rooms[5]!.chance = 1; b.equipped = null;
    f.game.choose(b.playerId, b.id, 'risk'); f.advance();
    const p = f.game.players.get(b.playerId)!;
    assert.equal(b.phase, 'banked'); assert.equal(b.rescue!.rope.donor.name, 'Noodle');
    assert.equal(p.ore, 35); assert.equal(p.climbs, 1); assert.equal(p.inventory.includes('crown'), false);
    assert.equal(f.game.rescueLine.ropes.b, undefined);
    f.advance(30000); assert.equal(p.ore, 35); assert.equal(p.climbs, 1);
});

test('Hype supplies add a fixed five ore on rescue, without multiplying or granting extra ropes', () => {
    const f = fixture(); const a = f.cache();
    f.game.receiveHype({ id: 'hype', team: 'a', kind: 'begin', level: 30, startedAt: f.now(), expiresAt: f.now() + 5000 }, true);
    f.game.choose(a.playerId, a.id, 'keep');
    assert.equal(f.game.rescueLine.ropes.b!.bonusOre, RESCUE_RULES.hypeOre);
    const b = f.cache('demo:mossboss'); b.hp = 2; b.rooms[3]!.chance = 1;
    f.game.choose(b.playerId, b.id, 'risk'); f.advance();
    assert.equal(b.loot, 20); assert.equal(b.rescue!.ore, 20);
    assert.equal(f.game.hype.a, undefined);
});

test('fatal gift rock uses a rope once and reports rescued, not lost', () => {
    const f = fixture(); f.game.configure({ giftRocks: true });
    const a = f.cache(); f.game.choose(a.playerId, a.id, 'keep');
    const b = f.cache('demo:mossboss'); b.hp = 1;
    f.game.choose(b.playerId, b.id, 'risk'); f.roll(0);
    const event = { id: 'gift', team: 'b' as const, name: 'Gifter', total: 10, at: f.now() };
    f.game.receiveGift(event, true); f.advance(8000);
    assert.equal(f.game.rocks[0]!.status, 'rescued'); assert.equal(b.phase, 'banked');
    assert.equal(f.game.players.get(b.playerId)!.ore, 15);
    f.game.receiveGift(event, true); f.advance(10000);
    assert.equal(f.game.players.get(b.playerId)!.climbs, 1);
});

test('one rescue each way grants a persistent cosmetic with both camps and people; practice respects one slot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rescue-')); const file = join(dir, 'profiles.json');
    try {
        const f = fixture(new ProfileStore(file)); f.game.configure({ slots: 1 });
        f.game.startRescuePractice();
        for (let leg = 0; leg < 2; leg++) {
            let run = f.game.runs[0]!;
            assert.equal(f.game.runs.length, 1); assert.equal(run.phase, 'choice');
            f.advance(20000); assert.equal(run.phase, 'choice');
            assert.throws(() => f.game.dig('demo:peach'), /practice/);
            assert.throws(() => f.game.choose(run.playerId, run.id, 'risk'), /choose Keep/);
            f.game.choose(run.playerId, run.id, 'keep'); f.advance(6000);
            run = f.game.runs[0]!;
            assert.equal(run.team, leg === 0 ? 'b' : 'a');
            assert.throws(() => f.game.choose(run.playerId, run.id, 'keep'), /choose Risk/);
            f.game.choose(run.playerId, run.id, 'risk'); f.advance();
            assert.ok(run.rescue); assert.equal(run.phase, 'banked'); f.advance(6000);
        }
        assert.equal(f.game.practice!.done, true);
        const keepsake = f.game.rescueLine.keepsake!;
        assert.deepEqual(keepsake.camps, ['Camp A', 'Camp B']);
        assert.deepEqual(new Set(keepsake.people.map(p => p.id)), new Set(['demo:noodle', 'demo:mossboss']));
        assert.equal(f.game.players.get('demo:peach')!.keepsakes?.length ?? 0, 0);
        const restored = new ProfileStore(file);
        assert.deepEqual(restored.profiles['demo:noodle']!.keepsakes, [keepsake]);
        assert.deepEqual(restored.profiles['demo:mossboss']!.keepsakes, [keepsake]);
        f.game.setMode('demo'); assert.equal(f.game.rescueLine.keepsake, null);
        assert.equal(f.game.players.get('demo:noodle')!.keepsakes!.length, 1);
        // Invalid nested records must not silently overwrite a save.
        const broken = JSON.parse(readFileSync(file, 'utf8'));
        broken.profiles['demo:noodle'].keepsakes[0].people[0].team = 'x';
        writeFileSync(file, JSON.stringify(broken));
        assert.throws(() => new ProfileStore(file), /has not been overwritten/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('disconnect clears pending help; solo climbs and reconnect work; a new partner cannot inherit rescues', () => {
    const f = fixture();
    f.game.setConnection('a', 'alpha', 'connected', ''); f.game.setConnection('b', 'beta', 'connected', ''); f.game.setMode('live');
    f.game.join('twitch:1', 'One', 'a'); f.game.join('twitch:2', 'Two', 'b');
    const a = f.cache('twitch:1'); f.game.choose(a.playerId, a.id, 'keep');
    assert.equal(f.game.rescueLine.ropes.b!.donor.camp, 'alpha');
    f.game.setConnection('a', 'alpha', 'error', 'Disconnected');
    assert.equal(f.game.snapshot().rescue.linked, false); assert.deepEqual(f.game.rescueLine.ropes, {});
    const b = f.cache('twitch:2'); b.hp = 2; b.rooms[3]!.chance = 1;
    f.game.choose(b.playerId, b.id, 'risk'); f.advance(); assert.equal(b.phase, 'lost');
    f.game.setConnection('a', 'alpha', 'connected', ''); assert.equal(f.game.snapshot().rescue.linked, true);
    f.game.rescueLine.send(donor, f.now() + 60000, false);
    f.game.setConnection('b', 'gamma', 'connected', '');
    assert.deepEqual(f.game.rescueLine.ropes, {}); assert.deepEqual(f.game.rescueLine.helped, {});
    assert.throws(() => f.game.startRescuePractice(), /only available/);
});

test('live choice timeout does not farm help; reset rejects old choices and removes delayed supplies', () => {
    const f = fixture();
    f.game.setConnection('a', 'alpha', 'connected', ''); f.game.setConnection('b', 'beta', 'connected', ''); f.game.setMode('live');
    f.game.join('twitch:1', 'One', 'a'); const a = f.cache('twitch:1');
    f.advance(45000); assert.equal(a.phase, 'banked'); assert.deepEqual(f.game.rescueLine.ropes, {});
    f.game.setMode('demo'); const run = f.cache(); f.game.choose(run.playerId, run.id, 'keep');
    f.game.setMode('demo'); assert.throws(() => f.game.choose(run.playerId, run.id, 'keep'));
    f.advance(RESCUE_RULES.travelMs); assert.deepEqual(f.game.rescueLine.ropes, {});
    assert.equal(f.game.snapshot().rescue.recent.length, 0);
});

test('full camp cannot starve a waiting partner, preserving order within each camp', () => {
    const f = fixture();
    f.game.dig('demo:noodle'); f.game.dig('demo:peach'); f.game.dig('demo:luna'); f.game.dig('demo:mossboss');
    f.advance(1500); f.advance(1500);
    assert.deepEqual(f.game.runs.map(r => r.playerId), ['demo:noodle', 'demo:mossboss', 'demo:peach']);
    assert.deepEqual(f.game.queue.map(q => q.playerId), ['demo:luna']);
});

test('one channel connected twice is not a partner; snapshots cannot mutate authoritative ropes', () => {
    const f = fixture(); const r = f.cache(); f.game.choose(r.playerId, r.id, 'keep');
    const snap = f.game.snapshot(); snap.rescue.ropes.b!.donor.name = 'Changed';
    assert.equal(f.game.rescueLine.ropes.b!.donor.name, 'Noodle');
    f.game.setConnection('a', 'same', 'connected', ''); f.game.setConnection('b', 'SAME', 'connected', ''); f.game.setMode('live');
    assert.equal(f.game.snapshot().rescue.linked, false);
});
