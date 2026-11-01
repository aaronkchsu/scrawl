import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIProvider } from '../src/ai.ts';
import { CaveWorkshop, caveCreator, validateCave, validFinds, type CaveBatch, type Cave } from '../src/expedition-caves.ts';
import { Expedition } from '../src/expedition.ts';
import { ProfileStore } from '../src/expedition-store.ts';

const pixels = Array.from({ length: 16 }, (_, i) => i < 2 || i > 13 ? '.'.repeat(16) : '..122222222223..');
const context = { source: 'a', target: 'b', fromCamp: 'Camp A', toCamp: 'Camp B' } as const;
const ideas = ['bees', 'ice', 'toaster'].map((text, i) => ({ id: `idea-${i}`, authorId: `demo:${i}`, name: `Viewer${i}`, text }));
const batch: CaveBatch = { ...context, ideas };
const raw = (b = batch, rule = 'gaps') => ({ name: 'Frozen Hive', enemyName: 'Frost bee', cacheName: 'Honey cache', findName: 'Honey toaster', rule, enemyPixels: pixels, findPixels: pixels, contributions: b.ideas.map(i => ({ messageId: i.id, feature: i.text })) });
const make = (b: CaveBatch) => validateCave(raw(b), b);
const settle = () => new Promise(resolve => setImmediate(resolve));
function seed(workshop: CaveWorkshop) { ideas.forEach(i => workshop.submit('a', i.authorId, i.name, i.text)); }

test('cave schema validates every contributor, bounded rules and safe pixel art', () => {
    assert.equal(make(batch).credits.length, 3);
    assert.throws(() => validateCave({ ...raw(), rule: 'kill_everyone' }, batch), /invalid cave/);
    assert.throws(() => validateCave({ ...raw(), enemyPixels: ['<script>'] }, batch), /invalid cave/);
    assert.throws(() => validateCave({ ...raw(), findPixels: Array(16).fill('.'.repeat(16)) }, batch), /invalid cave/);
    assert.throws(() => validateCave({ ...raw(), contributions: raw().contributions.slice(1) }, batch), /contributor/);
    assert.throws(() => validateCave({ ...raw(), contributions: Array(3).fill(raw().contributions[0]) }, batch), /contributor/);
});
test('API creates actual cave output with anonymous ideas and the existing request ceiling', async t => {
    let request: any;
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: any) => {
        request = JSON.parse(options.body);
        return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(raw()) }] }], usage: { input_tokens: 100, output_tokens: 200 } }));
    });
    const provider = new AIProvider({ OPENAI_API_KEY: 'mock', AI_MAX_REQUESTS: '1' });
    const create = caveCreator(provider);
    const cave = await create(batch, new AbortController().signal);
    assert.equal(cave.origin, 'ai'); assert.equal(cave.target, 'b');
    assert.equal(request.text.format.strict, true); assert.equal(request.store, false);
    assert.doesNotMatch(request.input, /Viewer|demo:/);
    assert.equal(provider.status().inputTokens, 100);
    await assert.rejects(create(batch, new AbortController().signal), /ceiling/);
});
test('one idea per viewer, duplicates collapse and a fair bounded batch is credited', async () => {
    let selected!: CaveBatch;
    const w = new CaveWorkshop(async b => { selected = b; return make(b); });
    seed(w);
    for (let i = 0; i < 100; i++) w.submit('a', 'demo:0', 'Viewer0', 'bees');
    for (let i = 0; i < 20; i++) w.submit('a', `copy${i}`, 'Copy', 'BEES!!');
    assert.equal(w.pools.a.length, 23);
    w.begin(context); await settle();
    assert.equal(selected.ideas.length, 3);
    assert.equal(selected.ideas.find(i => i.text === 'bees')!.name, 'Viewer0');
    for (let i = 0; i < 12; i++) w.submit('a', `new${i}`, 'New', `mushroom ${i}`);
    w.begin(context, false, () => .5); await settle();
    assert.equal(selected.ideas.length, 6);
    assert.equal(w.ready.b!.credits.length, 6);
});
test('generation is explicit, concurrent calls reject, reset discards late completions', async () => {
    let resolve!: (c: Cave) => void, calls = 0;
    const w = new CaveWorkshop(async b => { calls++; return new Promise(r => { resolve = r; }); });
    seed(w); assert.equal(calls, 0);
    w.begin(context); const pending = w.job!.batch;
    assert.throws(() => w.begin(context), /already/);
    w.reset(); resolve(make(pending)); await settle();
    assert.deepEqual(w.ready, {}); assert.equal(w.job, null); assert.equal(calls, 1);
});
test('error recovery retries the locked ideas and keeps an already playable cave', async () => {
    let fail = false; const received: CaveBatch[] = [];
    const w = new CaveWorkshop(async b => { received.push(structuredClone(b)); if (fail) throw new Error('Test timeout'); return make(b); });
    seed(w); w.begin(context); await settle(); const ready = w.ready.b;
    seed(w); fail = true; w.begin(context); await settle();
    assert.equal(w.job!.status, 'error'); assert.equal(w.ready.b, ready);
    w.submit('a', ideas[0]!.authorId, 'Viewer0', 'new idea');
    fail = false; w.begin(context, true); await settle();
    assert.deepEqual(received[2], received[1]);
});
test('three different viewers are required and more than 200 cannot flood a pool', () => {
    const w = new CaveWorkshop(async b => make(b));
    w.submit('a', 'one', 'One', 'bees'); w.submit('a', 'two', 'Two', 'bees'); w.submit('a', 'three', 'Three', 'ice');
    assert.throws(() => w.begin(context), /3 viewers/);
    for (let i = 3; i < 200; i++) w.submit('a', `viewer${i}`, 'Name', `idea${i}`);
    assert.throws(() => w.submit('a', 'overflow', 'Name', 'ice'), /full/);
    w.submit('a', 'one', 'One', 'a different idea');
    assert.equal(w.pools.a.length, 200);
});
test('successful caves free used ideas while preserving new and edited submissions', async () => {
    let resolve!: (c: Cave) => void;
    const w = new CaveWorkshop(async () => new Promise(r => { resolve = r; }));
    seed(w); w.submit('a', 'copy', 'Copy', 'BEES!!');
    w.begin(context); const locked = w.job!.batch;
    w.submit('a', ideas[0]!.authorId, 'Viewer0', 'mushrooms');
    w.submit('a', 'new', 'New', 'robot');
    resolve(make(locked)); await settle();
    assert.deepEqual(w.pools.a.map(i => i.text), ['mushrooms', 'robot']);
});
test('snapshot exposes climb cooldown without persisting it in the viewer profile', () => {
    let now = 1000;
    const g = new Expedition({ now: () => now });
    assert.equal(g.snapshot().players[0]!.digReadyAt, 0);
    g.dig('demo:noodle');
    assert.equal(g.snapshot().players[0]!.digReadyAt, now + g.settings.cooldownSeconds * 1000);
    assert.equal('digReadyAt' in g.store.profiles['demo:noodle']!, false);
});
test('generated rule changes future target routes, locks active runs, and keeps a find once', async () => {
    let now = 1000;
    const game = new Expedition({ now: () => now, random: () => .9, caveCreator: async b => make(b) });
    game.prepareCave('a', ['bees', 'ice', 'toaster']); game.generateCave('a'); await settle();
    game.dig('demo:mossboss'); const run = game.runs[0]!;
    assert.equal(run.cave!.source, 'a'); assert.equal(run.team, 'b');
    assert.deepEqual(run.rooms.slice(3).map(r => r.kind), ['gap', 'gap', 'slime']);
    game.caves.ready.b = validateCave(raw(batch, 'guards'), batch);
    assert.equal(run.cave!.rule, 'gaps');
    for (let i = 0; i < 3; i++) { now += 4000; game.tick(); }
    assert.equal(run.phase, 'choice');
    game.choose(run.playerId, run.id, 'keep');
    const p = game.players.get(run.playerId)!;
    assert.equal(p.finds!.length, 1); assert.equal(p.finds![0]!.findName, 'Honey toaster');
    assert.equal(validFinds(p.finds), true);
    assert.throws(() => game.choose(run.playerId, run.id, 'keep'), /ended/);
    game.setMode('demo'); assert.equal(game.players.get(run.playerId)!.finds!.length, 1);
    assert.deepEqual(game.caves.ready, {});
});
test('solo/live ideas, two-channel targeting and session isolation use authenticated Twitch input', async () => {
    const g = new Expedition({ caveCreator: async b => make(b) });
    const message = (team: 'a' | 'b', i: number, source: 'twitch' | 'demo' = 'twitch') => ({ id: `${team}${i}${source}`, userId: `${i}`, name: `Person${i}`, team, source, text: `!idea ${ideas[i]!.text}` });
    g.ingest(message('a', 0)); assert.equal(g.caves.pools.a.length, 0);
    g.setConnection('a', 'first', 'connected', ''); g.setMode('live');
    g.ingest(message('a', 0, 'demo')); assert.equal(g.caves.pools.a.length, 0);
    [0, 1, 2].forEach(i => g.ingest(message('a', i)));
    g.generateCave('a'); await settle(); assert.equal(g.caves.ready.a!.target, 'a');
    assert.throws(() => g.prepareCave('a', ['one', 'two', 'three']), /demo/);
    g.setConnection('b', 'second', 'connected', '');
    [0, 1, 2].forEach(i => g.ingest({ ...message('a', i), id: `next${i}` }));
    g.generateCave('a'); await settle(); assert.equal(g.caves.ready.b!.fromCamp, 'first');
    g.setMode('demo'); assert.equal(g.caves.pools.a.length, 0); assert.deepEqual(g.caves.ready, {});
});
test('climbs and rescue practice never trigger AI; practice clears generated rules', async () => {
    let calls = 0;
    const g = new Expedition({ caveCreator: async b => { calls++; return make(b); } });
    g.dig('demo:noodle'); g.startRescuePractice(); assert.equal(calls, 0);
    assert.throws(() => g.generateCave('a'), /practice/);
    assert.equal(g.runs[0]!.cave, undefined);
});
test('collected finds persist across process restarts; corrupt pixel data cannot enter a save', async t => {
    const dir = mkdtempSync(join(tmpdir(), 'scrawl-finds-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, 'save.json'), store = new ProfileStore(file);
    const g = new Expedition({ store }); const p = store.profiles['demo:noodle']!;
    const { id, name, findName, findPixels, credits, fromCamp } = make(batch);
    p.finds = [{ id, name, findName, findPixels, credits, fromCamp }]; store.save();
    assert.deepEqual(new ProfileStore(file).profiles[p.id]!.finds, p.finds);
    p.finds[0]!.findPixels = ['bad']; store.save();
    assert.throws(() => new ProfileStore(file), /could not be read/);
    writeFileSync(file, JSON.stringify({ version: 1, profiles: { [p.id]: { ...p, finds: undefined } } }));
    assert.deepEqual(new ProfileStore(file).profiles[p.id]!.finds, []);
});
