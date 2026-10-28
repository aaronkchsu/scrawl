import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { balanceMessages, demoCreation } from '../src/collective.ts';
import { fixtureRounds } from '../src/fixtures.ts';
import { validateCreation } from '../src/ai.ts';
import type { ChatMessage, Creation, TeamId } from '../src/types.ts';
let sequence=0;
const idea=(userId:string,text:string,team:TeamId='a',approach?:string):Omit<ChatMessage,'at'>=>({id:String(++sequence),userId,name:userId,text,team,approach,source:'manual'});
const message=(user:string,text:string):ChatMessage=>({...idea(user,text),at:0});
const draw=async(game:Game)=>{game.openVote();await game.lock();};

test('offline drawings preserve several recognizable authors',()=>{
 const result=demoCreation([message('alice','a duck'),message('bob','give it a sponge'),message('cara','add wheels')]);
 assert.equal(result.body,'duck');assert.deepEqual(result.features,['sponge','wheels']);assert.equal(new Set(result.contributions.map(c=>c.name)).size,3);
});
test('the AI context adapter bounds each author',()=>{
 const messages=[message('a','duck'),message('b','duck'),message('c','duck'),...Array.from({length:100},(_,i)=>message('spammer',`robot ${i}`))];
 assert.equal(balanceMessages(messages).filter(m=>m.userId==='spammer').length,2);
});
test('one nomination per author prevents message spam from replacing other contributors',()=>{
 const game=new Game();game.start();for(const user of ['a','b','c'])game.ingest(idea(user,`${user} duck`));
 for(let i=0;i<400;i++)game.ingest(idea('spammer',`robot ${i}`));
 assert.equal(game.state.teams.a.messages.length,4);assert.equal(game.state.teams.a.nominationCount,4);game.close();
});
test('duplicate deliveries, duplicate ideas, ordinary Twitch chat and repeated braces do not add influence',()=>{
 const game=new Game();game.start();const event=idea('alice','duck sponge');
 assert.equal(game.ingest(event).accepted,true);assert.equal(game.ingest(event).accepted,false);
 assert.equal(game.ingest(idea('bob','DUCK, sponge!')).accepted,false);
 assert.equal(game.ingest({...idea('twitch-viewer','just chatting'),source:'twitch'}).accepted,false);
 assert.equal(game.ingest({...idea('twitch-viewer','!idea catch a jar robot'),source:'twitch'}).accepted,true);
 assert.equal(game.ingest(idea('alice','!brace')).accepted,true);assert.equal(game.ingest(idea('alice','!brace')).accepted,false);game.close();
});
test('the reservoir gives late nominees a chance and exposes no more than twelve candidates',()=>{
 const game=new Game({random:()=>0});game.start();for(let i=0;i<500;i++)game.ingest(idea(`viewer-${i}`,`invention ${i}`));
 assert.equal(game.state.teams.a.nominationCount,500);assert.equal(game.state.teams.a.messages.length,12);
 assert.ok(game.state.teams.a.messages.some(m=>m.userId==='viewer-499'));
 game.openVote();assert.equal(game.state.teams.a.finalists.length,3);assert.equal(new Set(game.state.teams.a.finalists.map(f=>f.message.userId)).size,3);game.close();
});
test('nominations lead to a real voting phase before any generation',async()=>{
 let calls=0;const game=new Game({creator:async input=>{calls++;return demoCreation(input.messages);}});game.start('ai');game.ingest(idea('alice','frog'));
 await assert.rejects(()=>game.lock(),/vote/);assert.equal(calls,0);game.openVote();assert.equal(game.state.phase,'voting');assert.equal(calls,0);
 await game.lock();assert.equal(calls,1);game.close();
});
test('each viewer has one active vote, changing it moves rather than multiplies influence',()=>{
 const game=new Game({random:()=>0.999});game.start();for(const name of ['a','b','c'])game.ingest(idea(name,`${name} creature`));
 assert.equal(game.ingest(idea('voter','!vote 1')).accepted,false);game.openVote();
 assert.equal(game.ingest(idea('voter','!vote 1')).accepted,true);
 for(let i=0;i<50;i++)assert.equal(game.ingest(idea('voter','!vote 1')).accepted,false);
 assert.equal(game.ingest(idea('voter','!vote 2')).accepted,true);
 assert.deepEqual(game.state.teams.a.finalists.map(f=>f.votes),[0,1,0]);assert.equal(game.state.teams.a.voterCount,1);
 assert.equal(game.ingest(idea('new','!vote 4')).accepted,false);assert.equal(game.ingest(idea('new','late idea')).accepted,false);game.close();
});
test('vote ties, including zero votes, select a real finalist without extra AI calls',async()=>{
 const game=new Game({random:()=>0.999});game.start();for(const name of ['a','b','c'])game.ingest(idea(name,`${name} duck`));
 game.openVote();await game.lock();assert.equal(game.state.teams.a.selectedId,'3');assert.equal(game.state.teams.a.creation.contributions.length,3);game.close();
});
test('the winner leads the creation and other finalists remain visible contributors',async()=>{
 let received:any;const game=new Game({random:()=>0.999,creator:async input=>{received=input;return demoCreation(input.messages);}});game.start('ai');
 game.ingest(idea('alice','duck','a','soak'));game.ingest(idea('bob','giant glass jar','a','catch'));game.ingest(idea('cara','roller skates','a','shield'));
 game.openVote();game.ingest(idea('voter','!vote 2'));await game.lock();
 assert.equal(received.messages[0].name,'bob');assert.equal(received.selection.approach.id,'catch');assert.equal(received.messages.length,3);assert.equal(game.state.teams.a.selectedId,'2');game.close();
});
test('pause freezes both nomination and voting deadlines',()=>{
 let now=1000;const game=new Game({now:()=>now});game.start();now+=5000;game.pause();assert.equal(game.state.remainingMs,30000);
 now+=90000;game.tick();assert.equal(game.state.phase,'building');game.pause();assert.equal(game.state.deadline,now+30000);
 game.openVote();now+=2000;game.pause();now+=90000;game.tick();assert.equal(game.state.phase,'voting');game.pause();assert.equal(game.state.deadline,now+10000);game.close();
});
test('a late AI completion cannot overwrite a reset encounter',async()=>{
 let complete:(value:Creation)=>void=()=>{};const game=new Game({creator:()=>new Promise(resolve=>{complete=resolve;})});
 game.start('ai');game.ingest(idea('alice','duck'));game.openVote();const generation=game.lock();game.reset();complete(demoCreation([message('alice','duck')]));await generation;
 assert.equal(game.state.phase,'lobby');assert.equal(game.state.teams.a.creation.body,'blank');assert.equal(game.state.teams.a.finalists.length,0);game.close();
});
test('generation failure preserves selected text for BOTH teams without applying damage',async()=>{
 const game=new Game({creator:async()=>{throw new Error('Simulated timeout');}});game.start('ai');game.ingest(idea('a','duck'));game.ingest(idea('b','robot','b','catch'));
 await draw(game);assert.equal(game.state.paused,true);assert.match(game.state.error!,/timeout/);assert.equal(game.state.boss.health,130);
 assert.ok(game.state.teams.a.selectedId);assert.ok(game.state.teams.b.selectedId);assert.equal(game.state.teams.a.score,0);game.close();
});
test('a retry preserves the winning recipe instead of rerolling the election',async()=>{
 const leads:string[]=[];let attempts=0;const game=new Game({creator:async input=>{leads.push(input.selection!.messageId);if(attempts++===0)throw Error('timeout');return demoCreation(input.messages);}});
 game.start('ai');for(const name of ['a','b','c'])game.ingest(idea(name,`${name} duck`));await draw(game);await game.lock();
 assert.equal(leads[0],leads[1]);assert.equal(game.state.phase,'reveal');game.close();
});
test('declared counters determine power even when AI returns unrelated abilities',async()=>{
 let now=1000;const game=new Game({now:()=>now,creator:async input=>({...demoCreation(input.messages),capabilities:['absorb','ground','move']})});game.start('ai');
 game.ingest(idea('a','duck','a','soak'));game.ingest(idea('b','robot','b','shield'));await draw(game);now+=6001;game.tick();
 assert.equal(game.state.teams.a.lastDamage,35);assert.equal(game.state.teams.b.lastDamage,18);assert.equal(game.state.teams.b.health,88);game.close();
});
test('a 500-person community and a 3-person community receive the same power allowance',async()=>{
 let now=1000;const game=new Game({now:()=>now});game.start();
 for(let i=0;i<500;i++)game.ingest(idea(`big-${i}`,`duck ${i}`,'a','soak'));
 for(let i=0;i<3;i++)game.ingest(idea(`small-${i}`,`robot ${i}`,'b','soak'));
 game.openVote();for(let i=0;i<500;i++)game.ingest(idea(`big-${i}`,'!vote 1','a'));for(let i=0;i<3;i++)game.ingest(idea(`small-${i}`,'!vote 1','b'));
 await game.lock();now+=6001;game.tick();assert.equal(game.state.teams.a.lastDamage,35);assert.equal(game.state.teams.b.lastDamage,35);assert.equal(game.state.teams.a.health,game.state.teams.b.health);game.close();
});
test('brace defense uses nominee participation, not raw extra messages or accounts',async()=>{
 let now=1000;const game=new Game({now:()=>now});game.start();for(let i=0;i<3;i++)game.ingest(idea(`a-${i}`,`duck ${i}`));
 for(let i=0;i<300;i++)assert.equal(game.ingest(idea(`outsider-${i}`,'!brace')).accepted,false);await draw(game);now+=6001;game.tick();assert.equal(game.state.teams.a.health,76);game.close();
});
test('complementary counters create a shared effect and both inventions form the final victory',async()=>{
 let now=1000;let calls=0;const game=new Game({now:()=>now,creator:async input=>{calls++;return demoCreation(input.messages);}});game.start('ai');
 for(let round=0;round<2;round++){
  for(const row of fixtureRounds[round])game.ingest(idea(row.name,row.text,row.team,row.approach));
  await draw(game);now+=6001;game.tick();assert.match(game.state.teams.a.result,/community combo/);now+=8001;game.tick();
 }
 assert.equal(game.state.phase,'finishing');assert.equal(game.state.boss.health,0);assert.equal(game.state.finisher!.components.length,2);assert.equal(calls,4);
 now+=5001;game.tick();assert.equal(game.state.phase,'finished');assert.equal(game.state.winner,'tie');assert.equal(calls,4);
 const snapshot=game.snapshot();snapshot.teams.a.score=999;assert.notEqual(game.state.teams.a.score,999);game.close();
});
test('the synthetic demo automatically nominates, votes and reaches a shared victory',async()=>{
 let now=1000;const game=new Game({now:()=>now});game.start('demo',true);
 for(let i=0;i<400&&game.state.phase!=='finished';i++){now+=250;game.tick();await new Promise<void>(resolve=>setImmediate(resolve));}
 assert.equal(game.state.phase,'finished');assert.equal(game.state.winner,'tie');assert.ok(game.state.finisher);game.close();
});
test('the second round clears votes and nominations and presents new public counters',async()=>{
 let now=1000;const game=new Game({now:()=>now});game.start();game.ingest(idea('alice','duck'));await draw(game);now+=6001;game.tick();now+=8001;game.tick();
 assert.equal(game.state.round,2);assert.equal(game.state.phase,'building');assert.equal(game.state.teams.a.voterCount,0);assert.equal(game.state.teams.a.finalists.length,0);assert.equal(game.state.approaches[0].id,'ground');
 assert.equal(game.ingest(idea('alice','duck with wire','a','soak')).accepted,false);assert.equal(game.ingest(idea('alice','duck with wire','a','ground')).accepted,true);game.close();
});
const validDrawing=(messages:ChatMessage[])=>({name:'Sponge duck',description:'A collective duck.',body:'duck',features:['sponge'],capabilities:['absorb'],contributions:messages.map(m=>({messageId:m.id,feature:m.text})),shapes:Array.from({length:3},()=>({kind:'ellipse',x:100,y:100,w:20,h:20,angle:0,path:'',fill:'#f9d45c',layer:'body'}))});
test('AI drawing validation rejects invented contributor IDs and executable markup',()=>{
 const messages=[message('alice','duck')];const raw=validDrawing(messages);assert.equal(validateCreation(raw,messages).origin,'ai');
 const forged=structuredClone(raw);forged.contributions[0].messageId='not-submitted';assert.throws(()=>validateCreation(forged,messages),/not submitted/);
 const injected=structuredClone(raw);injected.shapes[0].path='<script>alert(1)</script>';assert.throws(()=>validateCreation(injected,messages),/vector coordinates/);
});
test('AI drawing validation rejects unbounded effects and geometry',()=>{
 const messages=[message('alice','duck')];const raw=validDrawing(messages);const effects=structuredClone(raw);effects.capabilities=['absorb','ground','shield','move'];assert.throws(()=>validateCreation(effects,messages),/capabilities/);
 raw.shapes[0].w=Infinity;assert.throws(()=>validateCreation(raw,messages),/geometry/);
});
