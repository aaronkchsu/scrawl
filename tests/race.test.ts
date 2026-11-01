import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { demoCreation } from '../src/collective.ts';
import type { Creation, Creator } from '../src/types.ts';

function match(creator?: Creator) {
  let now = 1000;
  const game = new Game({ now: () => now, creator });
  game.start(creator ? 'ai' : 'demo', false, 'rehearsal');
  const advance = (ms: number) => { now += ms; game.tick(); };
  async function round(a: string, b: string) {
    game.submitRehearsal({ a: [{name:'orange',text:'a frog with wheels',approach:a}], b: [{name:'blue',text:'a robot with a hat',approach:b}] });
    game.voteRehearsal('a','1'); game.voteRehearsal('b','1');
    await game.lock(); game.playRehearsalFight(); advance(8001);
  }
  return { game, advance, round };
}

test('each attack damages only its own boss; rival choices grant no bonus',async()=>{
  const one=match(), two=match();
  await one.round('soak','catch'); await two.round('soak','shield');
  assert.equal(one.game.state.teams.a.boss.health,35);
  assert.equal(two.game.state.teams.a.boss.health,35);
  assert.equal(one.game.state.teams.b.boss.health,35);
  assert.equal(two.game.state.teams.b.boss.health,52);
  assert.equal(one.game.state.winner,null);
  one.game.close(); two.game.close();
});

test('either team can win by defeating its boss while the other survives',async()=>{
  for(const winner of ['a','b'] as const) {
    const {game,round,advance}=match();
    await round(winner==='a'?'soak':'shield',winner==='b'?'catch':'shield');
    await round('ground','reflect');
    assert.equal(game.state.winner,winner); assert.equal(game.state.resultReason,'boss-defeated');
    assert.equal(game.state.teams[winner].boss.health,0);
    assert.equal(game.state.teams[winner==='a'?'b':'a'].boss.health,17);
    advance(5001); assert.equal(game.state.phase,'finished'); game.close();
  }
});

test('same-round defeats draw even when fighter health differs',async()=>{
  const {game,round}=match();
  await round('soak','catch');
  game.state.teams.b.health=1;
  await round('ground','reflect');
  assert.equal(game.state.winner,'tie'); assert.equal(game.state.resultReason,'same-round');
  assert.deepEqual(Object.values(game.state.teams).map(t=>t.boss.health),[0,0]); game.close();
});

test('the round limit uses damage to each boss and preserves genuine ties',async()=>{
  for (const [a,b,winner] of [['soak','shield','a'],['shield','catch','b'],['shield','shield','tie']] as const) {
    const {game,round}=match(); await round(a,b); await round('shield','shield');
    assert.equal(game.state.winner,winner); assert.equal(game.state.resultReason,'round-limit');
    assert.ok(Object.values(game.state.teams).every(t=>t.boss.health>0)); game.close();
  }
});

test('a defeated boss ends the race without requiring every configured round',async()=>{
  const {game,round}=match(); game.state.teams.b.boss.health=35;
  await round('soak','catch');
  assert.equal(game.state.round,1); assert.equal(game.state.phase,'finishing');
  assert.equal(game.state.winner,'b'); game.close();
});

test('the faster AI response cannot deal damage or win ahead of the other team',async()=>{
  let release: (drawing: Creation)=>void = ()=>{};
  const {game,advance}=match(async input=>input.team==='a'
    ? new Promise(resolve=>{release=resolve;}) : demoCreation(input.messages));
  game.state.teams.a.boss.health=35; game.state.teams.b.boss.health=35;
  game.submitRehearsal({a:[{name:'a',text:'a frog',approach:'soak'}],b:[{name:'b',text:'a robot',approach:'catch'}]});
  game.voteRehearsal('a','1');game.voteRehearsal('b','1');
  const drawing=game.lock(); await Promise.resolve(); advance(120_000);
  assert.equal(game.state.phase,'generating');assert.equal(game.state.winner,null);
  assert.deepEqual(Object.values(game.state.teams).map(t=>t.boss.health),[35,35]);
  release(demoCreation(game.state.teams.a.messages));await drawing;
  assert.equal(game.state.phase,'reveal'); game.playRehearsalFight(); advance(8001);
  assert.equal(game.state.winner,'tie');assert.equal(game.state.resultReason,'same-round');game.close();
});

test('reset clears both bosses and the race outcome',async()=>{
  const {game,round}=match();await round('soak','shield');await round('ground','reflect');
  game.reset();assert.equal(game.state.winner,null);assert.equal(game.state.resultReason,null);
  assert.deepEqual(Object.values(game.state.teams).map(t=>t.boss.health),[70,70]);game.close();
});
