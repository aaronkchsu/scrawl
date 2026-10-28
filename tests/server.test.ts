import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.ts';
import { createServer } from 'node:net';

test('HTTP flow: controls require a session, overlays stay read-only, and settings never leak secrets',async()=>{
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;
  await new Promise<void>(resolve=>probe.close(()=>resolve()));
  const origin=`http://127.0.0.1:${port}`;
  const app=createApp({ PORT:String(port), BASE_URL:origin, HOST:'127.0.0.1', OPENAI_API_KEY:'test-secret-do-not-expose' });
  await new Promise<void>(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  const headers={Origin:origin,'Content-Type':'application/json'};
  const post=(path:string,body:unknown,cookie='')=>fetch(`${origin}${path}`,{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify(body)});
  try{
    assert.equal((await post('/api/action',{action:'demo'})).status,401);
    const login=await post('/api/session',{});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];
    app.game.setConnection('a','test-orange','connected','Test channel');app.game.setConnection('b','test-blue','connected','Test channel');
    const start=await post('/api/action',{action:'start',mode:'demo'},cookie);assert.equal(start.status,200);
    assert.equal((await post('/api/idea',{team:'a',name:'alice',text:'duck sponge'},cookie)).status,400);
    app.game.ingest({id:'one',userId:'alice',team:'a',name:'alice',text:'!idea soak duck sponge',source:'twitch'});
    const state=await fetch(`${origin}/api/state`).then(r=>r.text());assert.ok(!state.includes('test-secret-do-not-expose'));assert.equal(JSON.parse(state).state.teams.a.messages.length,1);
    const overlay=await fetch(`${origin}/overlay?team=b`);assert.equal(overlay.status,200);assert.match(await overlay.text(),/overlay.js/);
    const streamAbort=new AbortController();
    const feeds=await Promise.all([0,1].map(()=>fetch(`${origin}/api/events`,{signal:streamAbort.signal})));
    const readers=feeds.map(feed=>feed.body!.getReader());
    const initial=await Promise.all(readers.map(reader=>reader.read()));
    assert.equal(JSON.parse(new TextDecoder().decode(initial[0].value).split('\n')[0].slice(6)).state.id,JSON.parse(new TextDecoder().decode(initial[1].value).split('\n')[0].slice(6)).state.id);
    app.game.ingest({id:'two',userId:'bob',team:'b',name:'bob',text:'!idea catch robot bucket',source:'twitch'});
    const updates=await Promise.all(readers.map(reader=>reader.read()));
    const states=updates.map(update=>JSON.parse(new TextDecoder().decode(update.value).split('\n')[0].slice(6)).state);
    assert.equal(states[0].revision,states[1].revision);assert.equal(states[0].teams.b.messages[0].text,'robot bucket');
    streamAbort.abort();await Promise.all(readers.map(reader=>reader.cancel().catch(()=>{})));
    const nominateClose=await post('/api/action',{action:'lock'},cookie);assert.equal((await nominateClose.json() as any).state.phase,'voting');
    assert.equal(app.game.ingest({id:'three',userId:'alice',team:'a',name:'alice',text:'!vote 1',source:'twitch'}).accepted,true);
    assert.equal((await post('/api/action',{action:'lock'},cookie)).status,200);
    const revealed=await fetch(`${origin}/api/state`).then(r=>r.json()) as any;assert.equal(revealed.state.phase,'reveal');assert.equal(revealed.state.teams.a.selectedId,'1');
    const crossOrigin=await fetch(`${origin}/api/action`,{method:'POST',headers:{...headers,Origin:'https://attacker.example',Cookie:cookie},body:JSON.stringify({action:'reset'})});assert.equal(crossOrigin.status,403);
    assert.equal((await post('/api/action',{action:'start',mode:'bad'},cookie)).status,400);
  }finally{await app.close();}
});
test('binding a public interface requires an explicit control token',()=>{
  assert.throws(()=>createApp({HOST:'0.0.0.0',PORT:'4177'}),/CONTROL_TOKEN/);
});

test('rehearsal HTTP actions require host access, reject stale input and reserve both drawings within the request cap',async()=>{
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
  const origin=`http://127.0.0.1:${port}`;
  const app=createApp({PORT:String(port),BASE_URL:origin,HOST:'127.0.0.1',OPENAI_API_KEY:'mock-key-never-used',AI_MAX_REQUESTS:'1'});
  await new Promise<void>(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  let cookie='';const post=(path:string,body:unknown)=>fetch(`${origin}${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  try{
    assert.equal((await post('/api/rehearsal',{action:'ideas'})).status,401);
    const login=await post('/api/session',{});cookie=login.headers.get('set-cookie')!.split(';')[0];
    const start=await post('/api/action',{action:'rehearse',mode:'ai'});const started=await start.json() as any;
    assert.equal(started.state.experience,'rehearsal');assert.equal(started.state.deadline,null);
    const step={matchId:started.state.id,round:1};
    const ideas=Object.fromEntries(['a','b'].map(team=>[team,started.rehearsalPresets.filter((r:any)=>r.team===team)]));
    const invalid=structuredClone(ideas);invalid.b[0].text='';
    assert.equal((await post('/api/rehearsal',{...step,action:'ideas',ideas:invalid})).status,400);assert.equal(app.game.state.teams.a.nominationCount,0);
    assert.equal((await post('/api/rehearsal',{...step,matchId:'old',action:'ideas',ideas})).status,400);
    assert.equal((await post('/api/rehearsal',{...step,action:'ideas',ideas})).status,200);
    assert.equal((await post('/api/rehearsal',{...step,action:'draw'})).status,400);
    for(const team of ['a','b'])assert.equal((await post('/api/rehearsal',{...step,action:'vote',team,finalist:'1'})).status,200);
    assert.equal((await post('/api/rehearsal',{...step,action:'vote',team:'a',finalist:'1'})).status,200);assert.equal(app.game.state.teams.a.voterCount,1);
    const blocked=await post('/api/rehearsal',{...step,action:'draw'});assert.equal(blocked.status,400);assert.match((await blocked.json() as any).error,/2 API requests/);assert.equal(app.ai.status().requests,0);assert.equal(app.game.state.phase,'voting');
    assert.equal((await post('/api/action',{action:'lock'})).status,400);
    const manual=await post('/api/idea',{name:'manual',team:'a',text:'hello'});assert.equal(manual.status,400);
    await post('/api/action',{action:'reset'});
    assert.equal((await post('/api/action',{action:'start',mode:'demo',experience:'live'})).status,400);
  }finally{await app.close();}
});
