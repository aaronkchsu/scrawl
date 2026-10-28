import { $, esc } from './ui.js';
import { renderBoard } from './shared.js';
import { mountLauncher, renderLauncher } from './launcher.js';
import { renderRehearsal, submitIdeas, stepContent } from './rehearsal.js';
import { renderSetup } from './setup.js';
let current, authenticated=false, connected=false, busy=false, offset=0, previousPhase='', sound=false, audio, toastTimer;
const signatures={};
const once=(key,value,render)=>{if(signatures[key]!==value){signatures[key]=value;render();}};
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function error(message){$('app-error').textContent=message;$('app-error').hidden=false;$('app-error').scrollIntoView({block:'nearest',behavior:'smooth'});}
async function post(path,body,retried=false){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(response.status===401&&path!=='/api/session'&&!retried){await post('/api/session',{});authenticated=true;return post(path,body,true);}
  if(response.status===401){authenticated=false;if(current)render(current);}
  if(!response.ok)throw new Error(result.error||'Could not complete that step. Try again.');
  return result;
}
async function run(fn){
  if(busy)return;
  const focused=document.activeElement;
  const focusId=focused?.id;
  const voteFocus=focused?.dataset?.finalist ? `[data-team="${focused.dataset.team}"][data-finalist="${focused.dataset.finalist}"]` : null;
  busy=true;$('app-error').hidden=true;if(current)render(current);
  try{return await fn();}catch(e){error(e.message||'Connection failed. Check that the server is running.');}
  finally{busy=false;if(current)render(current);const restore=voteFocus?document.querySelector(voteFocus):focusId?$(focusId):null;if(restore&&!restore.disabled&&restore.getClientRects().length)restore.focus({preventScroll:true});}
}
function route(){
  let view=location.hash.slice(1)||'home';
  if(!['home','rehearse','setup','encounter'].includes(view))view='home';
  if(view==='encounter'&&current?.state.phase==='lobby')view='home';
  for(const name of ['home','rehearse','setup','encounter'])$(`${name}-view`).hidden=name!==view;
}
function cue(){if(!sound)return;audio??=new AudioContext();const time=audio.currentTime;[261.6,329.6,392].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,time+i*.07);g.gain.linearRampToValueAtTime(.035,time+i*.07+.01);g.gain.exponentialRampToValueAtTime(.001,time+i*.07+.15);o.connect(g);g.connect(audio.destination);o.start(time+i*.07);o.stop(time+i*.07+.16);});}
const actions={
  toast,error,
  start:(action,mode='demo')=>run(async()=>{const p=await post('/api/action',{action,mode,...(action==='start'?{experience:'live'}:{})});render(p);location.hash='encounter';$('session-title').focus();window.scrollTo({top:0});}),
  rehearsal:(action,extra={})=>run(async()=>{const p=await post('/api/rehearsal',{action,matchId:current.state.id,round:current.state.round,...extra});render(p);if(action==='vote'){document.querySelector(`[data-team="${extra.team}"][data-finalist="${extra.finalist}"]`)?.focus();}else{$('session-title').focus();window.scrollTo({top:0,behavior:'smooth'});}}),
  control:action=>run(async()=>{render(await post('/api/action',{action}));}),
  connect:(team,disconnect)=>run(async()=>{const r=await post(`/api/twitch/${disconnect?'disconnect':'connect'}`,{team});if(r.url)location.assign(r.url);else render(await fetch('/api/state').then(r=>r.json()));})
};
function render(payload){
  if(current?.state.id===payload.state.id && current.state.revision>payload.state.revision)return;
  current=payload;offset=payload.now-Date.now();const s=payload.state;
  const enabled=authenticated&&connected&&!busy;
  $('access-form').hidden=authenticated;
  $('connection-notice').hidden=connected;
  renderLauncher(payload,enabled,actions);renderSetup(payload,enabled,actions);renderRehearsal(payload,enabled,actions);
  route();renderBoard(s,payload.now);
  $('encounter-board').hidden=s.experience==='rehearsal'&&['building','voting'].includes(s.phase);
  if(previousPhase&&previousPhase!==s.phase)cue();previousPhase=s.phase;
  const label=s.experience==='rehearsal'?'Rehearsal':s.experience==='demo'?'Scripted demo':'Live Twitch encounter';
  $('session-title').textContent=label;
  $('session-note').textContent=`${s.experience==='live'?'Real Twitch participants':'Simulated participants'} · ${s.mode==='ai'?'AI drawings · paid calls':'Sample artwork · free'}${s.experience==='rehearsal'?' · waits for you':''}`;
  $('encounter-label').textContent=s.phase==='finished'?'ENCOUNTER COMPLETE':label.toUpperCase();
  $('round-label').textContent=`ROUND ${s.round} / ${s.maxRounds}`;
  $('end-encounter').disabled=!enabled||s.phase==='lobby';
  const step={building:0,voting:1,generating:2,reveal:3,resolving:4,finishing:4,finished:4}[s.phase]??0;
  once('stepper',String(step),()=>{$('stepper').innerHTML=['Ideas','Vote','Draw','Inspect','Fight'].map((name,i)=>`<li ${i===step?'aria-current="step"':''} class="${i<step?'complete':''}"><span>${i<step?'✓':i+1}</span>${name}</li>`).join('');});
  const detail=stepContent(payload);
  once('next',JSON.stringify([detail,enabled,s.phase]),()=>{
    $('next-step').innerHTML=`<span class="eyebrow">${s.experience==='rehearsal'?'YOUR NEXT STEP':'ENCOUNTER CONTROLS'}</span><h2>${esc(detail.title)}</h2><p>${esc(detail.text)}</p><button id="step-action" class="button primary" ${!enabled||detail.disabled?'disabled':''}>${esc(detail.label)}</button><p class="step-note">${esc(detail.note||'')}</p>${s.phase==='finished'?'<button id="result-home" class="button secondary">Back to home</button>':''}`;
    $('step-action').onclick=()=>{
      if(detail.action==='ideas')return submitIdeas(actions);
      if(detail.action==='again'){if(s.experience==='rehearsal')location.hash='rehearse';else if(s.experience==='demo')actions.start('demo');else location.hash='setup';return;}
      if(detail.action==='pause')return actions.control('pause');
      if(detail.action==='retry'&&s.experience!=='rehearsal')return actions.control('retry');
      return actions.rehearsal(detail.action);
    };
    if($('result-home')){$('result-home').disabled=!enabled;$('result-home').onclick=()=>run(async()=>{render(await post('/api/action',{action:'reset'}));location.hash='home';});}
  });
  $('communities').hidden=!['reveal','resolving','finishing','finished'].includes(s.phase);
  once('credits',JSON.stringify([s.teams,s.experience]),()=>{$('communities').innerHTML=Object.values(s.teams).map(t=>`<article class="community-card" style="--team-color:${t.color}"><span class="team-caption">${esc(t.name)} · ${s.experience==='live'?'TWITCH':'SIMULATED'}</span><h3>${esc(t.creation.name)}</h3><p class="description">${esc(t.creation.description)}</p><div class="contribution-chips">${t.creation.contributions.map(c=>`<span class="contribution-chip"><strong>${esc(c.name)}</strong> ↳ ${esc(c.feature)}</span>`).join('')}</div>${t.result?`<p class="result-note">${esc(t.result)}</p>`:''}</article>`).join('');});
  const ai=payload.capabilities.ai;
  once('technical',JSON.stringify([ai,s.log,s.phase,enabled,s.experience]),()=>{
    $('technical-content').innerHTML=`<div class="technical-grid"><section><h3>AI usage</h3><p>${ai.configured?esc(ai.model):'AI not configured'} · ${ai.requests} / ${ai.maxRequests} calls used</p><p>${ai.inputTokens.toLocaleString()} input tokens · ${ai.outputTokens.toLocaleString()} output tokens</p><p>${ai.unreportedRequests?`${ai.unreportedRequests} earlier attempts have no returned usage and may still have charges.`:'All attempts have reported usage.'}</p><a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer">Check billed usage ↗</a><p class="muted">This is a request cap, not a dollar budget. Keys and credentials stay on the server.</p></section><section><h3>Encounter log</h3>${s.log.slice(-6).map(row=>`<p>${esc(row.text)}</p>`).join('')||'<p>No encounter started.</p>'}${s.experience==='live'?`<button id="host-lock" class="button secondary" ${!enabled||!['building','voting'].includes(s.phase)||s.paused?'disabled':''}>${s.phase==='voting'?'Close vote & draw':'Open vote now'}</button>`:''}</section></div>`;
    if($('host-lock'))$('host-lock').onclick=()=>actions.control('lock');
  });
}
mountLauncher(actions);
window.addEventListener('hashchange',()=>{route();window.scrollTo({top:0});});
$('end-encounter').onclick=()=>run(async()=>{render(await post('/api/action',{action:'reset'}));location.hash='home';});
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));if(sound){audio??=new AudioContext();void audio.resume();cue();}};
$('access-form').onsubmit=event=>{event.preventDefault();run(async()=>{await post('/api/session',{token:$('access-token').value});authenticated=true;$('access-token').value='';});};
async function init(){
  try{
    const initial=await fetch('/api/state').then(r=>{if(!r.ok)throw new Error('Server unavailable.');return r.json();});authenticated=initial.authenticated;
    if(!authenticated){try{await post('/api/session',{});authenticated=true;}catch{}}
    connected=true;render(initial);
    if(!location.hash&&initial.state.phase!=='lobby')location.hash='encounter';
    if(new URLSearchParams(location.search).has('connected')){history.replaceState({},'',location.pathname+'#setup');route();toast('Channel connected. Continue the Twitch checklist.');}
    const stream=new EventSource('/api/events');
    stream.onopen=()=>{connected=true;$('connection').classList.remove('offline');$('connection').innerHTML='<i></i>Server connected';if(current)render(current);};
    stream.onerror=()=>{connected=false;$('connection').classList.add('offline');$('connection').innerHTML='<i></i>Reconnecting';if(current)render(current);};
    stream.onmessage=event=>render(JSON.parse(event.data));
  }catch(e){error(`${e.message} Start the local server with npm start, then reload this page.`);$('watch-demo').disabled=true;}
}
setInterval(()=>{if(current)renderBoard(current.state,Date.now()+offset);},200);
void init();
