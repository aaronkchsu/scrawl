import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { rehearsalIdeas } from '../src/rehearsal.ts';
import { fixtureRounds } from '../src/fixtures.ts';
import { demoCreation } from '../src/collective.ts';
import type { Creator } from '../src/types.ts';
const rows = (round = 1) => Object.fromEntries(['a','b'].map(team => [team, fixtureRounds[round - 1].filter(r=>r.team===team)]));
const submit = (g: Game) => g.submitRehearsal(rehearsalIdeas(rows(g.state.round),g.state.approaches));

test('rehearsal holds editing, voting and reveal, then combat advances to a held second round', async()=>{
  let now=1000,calls=0;
  const game=new Game({now:()=>now,creator:async input=>{calls++;return {...demoCreation(input.messages), contributions: input.messages.map(m=>({messageId:m.id,name:m.name,feature:m.text}))};}});
  game.start('ai',false,'rehearsal');
  now+=100_000;game.tick();assert.equal(game.state.phase,'building');assert.equal(calls,0);
  assert.throws(()=>game.pause(),/waits for you/);
  submit(game);now+=100_000;game.tick();assert.equal(game.state.phase,'voting');assert.equal(calls,0);
  game.voteRehearsal('a','1');game.voteRehearsal('b',game.state.teams.b.finalists.find(f=>f.approach.impact===35)!.id);await game.lock();
  assert.equal(calls,2);assert.equal(game.state.phase,'reveal');
  now+=100_000;game.tick();assert.equal(game.state.phase,'reveal');assert.deepEqual(Object.values(game.state.teams).map(t=>t.boss.health),[70,70]);
  assert.equal(game.state.teams.a.creation.contributions.length,3);
  game.playRehearsalFight();assert.equal(game.state.phase,'resolving');
  now+=8001;game.tick();assert.equal(game.state.phase,'building');assert.equal(game.state.round,2);
  now+=100_000;game.tick();assert.equal(game.state.phase,'building');assert.equal(game.state.teams.a.voterCount,0);
  submit(game);game.voteRehearsal('a','1');game.voteRehearsal('b',game.state.teams.b.finalists.find(f=>f.approach.impact===35)!.id);await game.lock();game.playRehearsalFight();
  now+=8001;game.tick();assert.equal(game.state.phase,'finishing');now+=5001;game.tick();
  assert.equal(game.state.phase,'finished');assert.equal(game.state.winner,'tie');assert.equal(calls,4);game.close();
});
test('rehearsal votes move rather than stack and all three finalists contribute',async()=>{
  const game=new Game();game.start('demo',false,'rehearsal');submit(game);
  game.voteRehearsal('a','1');for(let i=0;i<20;i++)game.voteRehearsal('a','1');game.voteRehearsal('a','2');game.voteRehearsal('b','3');
  assert.deepEqual(game.state.teams.a.finalists.map(f=>f.votes),[0,1,0]);assert.equal(game.state.teams.a.voterCount,1);
  await game.lock();assert.equal(game.state.teams.a.selectedId,'2');assert.equal(game.state.teams.a.creation.contributions.length,3);game.close();
});
test('rehearsals reject Twitch and manual input; live games reject simulated participants',()=>{
  const game=new Game();const input={id:'one',userId:'viewer',name:'viewer',team:'a' as const,text:'!idea soak a duck'};
  game.start('demo',false,'rehearsal');
  assert.equal(game.ingest({...input,source:'twitch'}).accepted,false);assert.equal(game.ingest({...input,source:'manual'}).accepted,false);
  game.reset();game.start();
  assert.equal(game.ingest({...input,source:'rehearsal'}).accepted,false);assert.equal(game.ingest({...input,source:'demo'}).accepted,false);
  assert.equal(game.ingest({...input,source:'twitch'}).accepted,true);assert.throws(()=>game.playRehearsalFight(),/Inspect/);game.close();
});
test('the whole rehearsal form is validated before any ideas are admitted',()=>{
  const game=new Game();game.start('demo',false,'rehearsal');const invalid=structuredClone(rows());invalid.b[2].text='';
  assert.throws(()=>game.submitRehearsal(rehearsalIdeas(invalid,game.state.approaches)),/Blue idea 3/);
  assert.equal(game.state.teams.a.nominationCount,0);assert.equal(game.state.teams.b.nominationCount,0);
  invalid.b[2].text=invalid.b[0].text;assert.throws(()=>rehearsalIdeas(invalid,game.state.approaches),/duplicate/);game.close();
});
test('failed rehearsal generation holds recipes; retry and reset cannot silently change the result',async()=>{
  let fail=true;
  const game=new Game({creator:async input=>{if(fail)throw new Error('Try again');return demoCreation(input.messages);}});
  game.start('ai',false,'rehearsal');submit(game);game.voteRehearsal('a','2');game.voteRehearsal('b',game.state.teams.b.finalists.find(f=>f.approach.impact===35)!.id);await game.lock();
  assert.equal(game.state.phase,'generating');assert.ok(game.state.error);const chosen=game.state.teams.a.selectedId;
  fail=false;await game.lock();assert.equal(game.state.phase,'reveal');assert.equal(game.state.deadline,null);assert.equal(game.state.teams.a.selectedId,chosen);game.close();
  let release:()=>void=()=>{};const waiting=new Promise<void>(resolve=>release=resolve);
  const creator:Creator=async input=>{await waiting;return demoCreation(input.messages);};
  const stale=new Game({creator});stale.start('ai',false,'rehearsal');submit(stale);const generating=stale.lock();stale.reset();release();await generating;assert.equal(stale.state.phase,'lobby');assert.equal(stale.state.teams.a.creation.body,'blank');stale.close();
});
