import { $, esc, artworkChoices } from './ui.js';
let signature = '';
export function renderSetup(payload, enabled, actions) {
  const s = payload.state, ai = payload.capabilities.ai;
  const active = !['lobby','finished'].includes(s.phase);
  const key = JSON.stringify([s.teams.a.channel,s.teams.b.channel,s.teams.a.connection,s.teams.b.connection,s.teams.a.connectionNote,s.teams.b.connectionNote,payload.capabilities.twitch,ai.configured,ai.maxRequests-ai.requests,enabled,active]);
  if (key === signature) return;
  signature = key;
  const mode = document.querySelector('[name=live-art]:checked')?.value || 'demo';
  const ready = Object.values(s.teams).every(t=>t.connection==='connected');
  $('setup-view').innerHTML = `<div class="page-heading"><a href="#home" class="quiet-link">← Home</a><h1>Set up Twitch</h1><p>Connect two channels. Each stream shows both fights and its own win or loss.</p></div>
  <ol class="setup-checklist">
    <li class="panel"><h2><span class="check-number">1</span> Connect the two Twitch channels</h2>${!payload.capabilities.twitch ? `<div class="notice">Twitch sign-in isn’t configured yet. You can still watch a demo or try your own ideas.</div><details><summary>Show local Twitch setup instructions</summary><p>Register a Twitch application for SCRAWL. Set these server variables in this project’s <code>.env</code>, then restart with <code>npm start</code>:</p><pre>TWITCH_CLIENT_ID=your_client_id\nTWITCH_CLIENT_SECRET=your_client_secret</pre><p>Use this OAuth redirect URL:</p><code class="breakable">${esc(location.origin)}/auth/twitch/callback</code><p>Keep credentials in the server environment. Each channel owner signs in through Twitch below.</p></details>` : '<p>Sign in with a different Twitch account for each team.</p>'}<div class="setup-cards">${Object.values(s.teams).map(t=>`<article class="setup-card" style="--team-color:${t.color}"><div class="setup-card-heading"><span class="team-circle"></span><strong>${t.id==='a'?'Orange':'Blue'} team</strong><span>${esc(t.connection)}</span></div><p>${t.channel ? esc(t.channel) : 'No channel connected'}</p><p>${esc(t.connectionNote)}</p><button data-connect="${t.id}" class="button secondary" ${!payload.capabilities.twitch||!enabled||active?'disabled':''}>${t.channel?'Reconnect':'Connect'} ${t.id==='a'?'orange':'blue'} channel ↗</button>${t.channel?`<button data-disconnect="${t.id}" class="button subtle" ${!enabled||active?'disabled':''}>Disconnect</button>`:''}</article>`).join('')}</div></li>
    <li class="panel"><h2><span class="check-number">2</span> Add each team’s overlay to OBS</h2><p>In OBS: Sources → + → Browser. Paste the team’s URL and set <strong>1920 × 1080</strong>.</p>${['a','b'].map(t=>`<div class="overlay-setup-row"><strong>${t==='a'?'Orange':'Blue'} team</strong><code>${esc(location.origin)}/overlay?team=${t}</code><button class="button secondary small" data-copy="${t}">Copy ${t==='a'?'orange':'blue'} URL</button><a href="/overlay?team=${t}&preview=1" target="_blank" rel="noreferrer">Preview ↗</a></div>`).join('')}<p class="muted">${['localhost','127.0.0.1'].includes(location.hostname)?'These localhost URLs work on this computer. Two remote streamers need one shared HTTPS server first.':''} The overlay appears when you start and clears when you stop.</p></li>
    <li class="panel"><h2><span class="check-number">3</span> Start a game</h2>${artworkChoices('live',ai,mode)}<p>Viewers send ideas with <code>!idea soak a duck with a sponge</code>, then vote with <code>!vote 1</code>. The overlay shows viewers what to type.</p><button id="start-live" class="button primary" ${!enabled||!ready||active?'disabled':''}>Start game</button><p class="muted">${active?'End the current game first.':!ready?'Connect both channels to unlock this button.':'Both channels are ready.'}</p></li>
  </ol><p><a href="#rehearse">Try it without Twitch →</a></p>`;
  $('start-live').onclick = ()=>actions.start('start',document.querySelector('[name=live-art]:checked').value);
  $('setup-view').onclick = async event=>{
    const b=event.target.closest('[data-connect],[data-disconnect],[data-copy]');if(!b)return;
    if(b.dataset.copy) {try{await navigator.clipboard.writeText(`${location.origin}/overlay?team=${b.dataset.copy}`);actions.toast('Overlay URL copied. Paste it into an OBS Browser Source.');}catch{actions.error('Copy failed. Select the overlay URL above and copy it manually.');}}
    else actions.connect(b.dataset.connect||b.dataset.disconnect,Boolean(b.dataset.disconnect));
  };
}
