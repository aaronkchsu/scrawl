import { esc } from './doodles.js';
import { renderBoard } from './shared.js';
const perspective=new URLSearchParams(location.search).get('team')==='b'?'b':'a';
const preview=new URLSearchParams(location.search).get('preview')==='1';
document.documentElement.style.background='transparent';
let current,offset=0,signature='';
const stream=new EventSource('/api/events');
stream.onopen=()=>document.body.classList.remove('disconnected');stream.onerror=()=>document.body.classList.add('disconnected');
stream.onmessage=event=>{
  current=JSON.parse(event.data);offset=current.now-Date.now();const s=current.state;
  document.body.classList.toggle('idle',s.phase==='lobby'&&!preview);
  renderBoard(s,current.now,perspective);
  document.getElementById('overlay-team').textContent=s.teams[perspective].name;
  document.getElementById('overlay-status').textContent=s.experience==='rehearsal'?'TEST · SIMULATED CHAT':s.experience==='demo'?'SCRIPTED DEMO':s.mode==='ai'?'TWITCH · AI ART':'TWITCH · SAMPLE ART';
  document.getElementById('overlay-error').hidden=!s.error;document.getElementById('overlay-error').textContent=s.error?'Drawing failed. Waiting for the host to retry.':'';
  const key=JSON.stringify([s.experience,s.teams.a.name,s.teams.b.name,s.teams.a.creation.contributions,s.teams.b.creation.contributions]);
  if(key!==signature){signature=key;document.getElementById('overlay-contributions').innerHTML=[s.teams[perspective],s.teams[perspective==='a'?'b':'a']].map(t=>`<div style="--team-color:${t.color}"><span class="team-caption">${esc(t.name)} · ${s.experience==='live'?'CHAT MADE THIS':'SIMULATED CHAT'}</span><div class="contribution-chips">${t.creation.contributions.map(c=>`<span class="contribution-chip"><strong>${esc(c.name)}</strong> ↳ ${esc(c.feature)}</span>`).join('')}</div></div>`).join('');}
};
setInterval(()=>{if(current)renderBoard(current.state,Date.now()+offset,perspective);},200);
