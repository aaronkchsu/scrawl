import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIProvider, creationSchema } from '../src/ai.ts';
import { approachesFor } from '../src/selection.ts';
import { emptyCreation } from '../src/collective.ts';
import type { CreatorInput } from '../src/types.ts';

const input = (): CreatorInput => ({ team:'a', messages:[{id:'source-1',userId:'alice',name:'alice',team:'a',text:'duck sponge',at:0,source:'manual'}], previous:emptyCreation(), weakness:'absorb', signal:new AbortController().signal });
const drawing = {name:'A collective duck',description:'Duck with sponge.',body:'duck',features:['sponge'],capabilities:['absorb'],contributions:[{messageId:'source-1',feature:'sponge'}],shapes:Array.from({length:3},()=>({kind:'ellipse',x:100,y:100,w:30,h:30,angle:0,path:'',fill:'#f9d45c',layer:'body'}))};

test('live AI adapter sends a strict schema, validates the actual output, and honors its request ceiling',async context=>{
  let request:any;
  context.mock.method(globalThis,'fetch',async(_url:unknown,options:any)=>{
    request=JSON.parse(options.body);
    return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(drawing)}]}],usage:{input_tokens:100,output_tokens:200}}),{status:200});
  });
  const provider=new AIProvider({OPENAI_API_KEY:'mock-test-key',AI_MAX_REQUESTS:'1'});
  const result=await provider.create(input());
  assert.equal(result.origin,'ai');assert.equal(result.contributions[0].name,'alice');
  assert.equal(request.text.format.strict,true);assert.equal(creationSchema.properties.features.maxItems,4);assert.equal(creationSchema.properties.features.items.maxLength,60);assert.equal(request.store,false);
  assert.equal(provider.status().inputTokens,100);assert.equal(provider.status().outputTokens,200);
  await assert.rejects(()=>provider.create(input()),/ceiling/);
});
test('a declined AI request is surfaced as a held drawing, not replaced by pretend generated art',async context=>{
  context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'refusal',refusal:'Declined'}]}]}),{status:200}));
  const provider=new AIProvider({OPENAI_API_KEY:'mock-test-key'});
  await assert.rejects(()=>provider.create(input()),/declined/);
});
test('an invalid request ceiling cannot silently disable the spending guard',()=>{
  assert.throws(()=>new AIProvider({AI_MAX_REQUESTS:'not-a-number'}),/AI_MAX_REQUESTS/);
  assert.throws(()=>new AIProvider({AI_MAX_REQUESTS:'-1'}),/AI_MAX_REQUESTS/);
});

// An aborted request may still cost money, so it must survive a server restart.
test('the ledger preserves failed attempts, token usage, and the ceiling across restarts',async context=>{
  const folder=mkdtempSync(join(tmpdir(),'scrawl-ai-'));
  context.after(()=>rmSync(folder,{recursive:true,force:true}));
  const env={OPENAI_API_KEY:'mock-test-key',AI_MAX_REQUESTS:'2',AI_USAGE_FILE:join(folder,'usage.json')};
  context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(drawing)}]}],usage:{input_tokens:100,output_tokens:200}}),{status:200}));
  await new AIProvider(env).create(input());
  context.mock.method(globalThis,'fetch',async()=>{throw new Error('connection interrupted');});
  const provider=new AIProvider(env);
  await assert.rejects(()=>provider.create(input()),/interrupted/);
  const restarted=new AIProvider(env);
  assert.equal(restarted.status().requests,2);assert.equal(restarted.status().reportedRequests,1);assert.equal(restarted.status().unreportedRequests,1);
  assert.equal(restarted.status().inputTokens,100);assert.equal(restarted.status().outputTokens,200);
  await assert.rejects(()=>restarted.create(input()),/ceiling/);
});

test('voted drawings must include the declared counter and credit all finalists',async context=>{
  let payload:any;
  context.mock.method(globalThis,'fetch',async(_url:unknown,options:any)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(drawing)}]}]}),{status:200});});
  const selected=input();selected.selection={messageId:'source-1',approach:approachesFor(1)[1]};
  await assert.rejects(()=>new AIProvider({OPENAI_API_KEY:'mock'}).create(selected),/selected counter/);
  selected.selection.approach=approachesFor(1)[0];selected.messages.push({...selected.messages[0],id:'source-2',userId:'bob',name:'bob',text:'roller skates'});
  await assert.rejects(()=>new AIProvider({OPENAI_API_KEY:'mock'}).create(selected),/finalist/);
  assert.equal(JSON.parse(payload.input).selection.leadMessageId,'source-1');
});
