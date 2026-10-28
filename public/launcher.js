import { $, artworkChoices } from './ui.js';
export function mountLauncher(actions) {
  $('home-view').innerHTML = `<section class="welcome"><span class="eyebrow">TWO CHATS. ONE SHARED MONSTER.</span><h1>From chat chaos<br>to <span class="handwritten">collective genius.</span></h1><p>Two communities invent ridiculous doodles, vote on their best ideas,<br class="desktop-only"> and team up to beat the Inkling. Start here.</p></section>
  <div id="resume-notice" class="notice" hidden>An encounter is already open. <a href="#encounter">Continue encounter →</a></div>
  <div class="launcher-grid">
    <article class="launch-card featured"><span class="launch-number">01 / JUST WATCH</span><span class="launch-sketch" aria-hidden="true">▶</span><h2>Watch a demo</h2><p>See the whole game play out. Sample viewers handle the ideas and votes.</p><button id="watch-demo" class="button primary">Watch a demo ↗</button><small>About a minute · scripted · free</small></article>
    <article class="launch-card"><span class="launch-number">02 / TAKE THE PENCIL</span><span class="launch-sketch" aria-hidden="true">✎</span><h2>Rehearse an encounter</h2><p>Edit both communities’ ideas. Choose their votes. See your inventions fight.</p><a class="button dark" href="#rehearse">Rehearse an encounter ↗</a><small>No Twitch accounts · waits for you</small></article>
    <article class="launch-card"><span class="launch-number">03 / BRING YOUR CHAT</span><span class="launch-sketch blue-sketch" aria-hidden="true">✳</span><h2>Set up Twitch</h2><p>Connect two channels and add the shared game to their OBS browser sources.</p><a class="button secondary" href="#setup">Set up Twitch ↗</a><small>For a real community encounter</small></article>
  </div>`;
  $('watch-demo').onclick = () => actions.start('demo');
}
let preparationKey = '';
export function renderLauncher(payload, enabled, actions) {
  const active = !['lobby', 'finished'].includes(payload.state.phase);
  $('resume-notice').hidden = !active;
  $('watch-demo').disabled = !enabled || active;
  const ai = payload.capabilities.ai;
  const key = JSON.stringify([active, enabled, ai.configured, ai.maxRequests - ai.requests]);
  if (key === preparationKey) return;
  preparationKey = key;
  const selected = document.querySelector('[name=rehearsal-art]:checked')?.value || 'demo';
  $('rehearse-view').innerHTML = `<div class="page-heading"><a href="#home" class="quiet-link">← Home</a><span class="eyebrow">YOUR PACE. BOTH COMMUNITIES.</span><h1>Take the pencil.</h1><p>We’ll give you three editable sample ideas for each community. Nothing moves until you’re ready.</p></div><div class="preparation panel">${artworkChoices('rehearsal', ai, selected)}<p class="muted">Participants are simulated. The same voting and combat rules apply. Preparing ideas and voting never make AI calls.</p><button id="begin-rehearsal" class="button primary" ${!enabled || active ? 'disabled' : ''}>Start rehearsal →</button>${active ? '<p><a href="#encounter">Continue or end your current encounter first.</a></p>' : ''}</div>`;
  $('begin-rehearsal').onclick = () => actions.start('rehearse', document.querySelector('[name=rehearsal-art]:checked').value);
}
