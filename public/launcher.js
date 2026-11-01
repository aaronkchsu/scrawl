import { $, artworkChoices } from './ui.js';
export function mountLauncher(actions) {
  $('home-view').innerHTML = `<section class="welcome"><h1>Two chats. Two bosses.<br><span class="handwritten">Who wins?</span></h1><p>Chat builds a fighter to beat its own boss.<br class="desktop-only"> Both fights play on each stream.</p></section>
  <div id="resume-notice" class="notice" hidden>A game is running. <a href="#encounter">Back to game →</a></div>
  <div class="launcher-grid">
    <article class="launch-card featured"><span class="launch-sketch" aria-hidden="true">▶</span><h2>Watch a demo</h2><p>Watch two chats race their bosses. Scripted and automatic.</p><button id="watch-demo" class="button primary">Watch demo</button><small>1 minute · scripted · free</small></article>
    <article class="launch-card"><span class="launch-sketch" aria-hidden="true">✎</span><h2>Try your own ideas</h2><p>Edit both teams’ ideas, pick your favorites, then start the fight.</p><a class="button dark" href="#rehearse">Try it</a><small>No Twitch needed · go at your own pace</small></article>
    <article class="launch-card"><span class="launch-sketch blue-sketch" aria-hidden="true">✳</span><h2>Play with Twitch</h2><p>Connect two channels. Show both fights on each stream.</p><a class="button secondary" href="#setup">Set up Twitch</a><small>Requires Twitch and OBS</small></article>
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
  $('rehearse-view').innerHTML = `<div class="page-heading"><a href="#home" class="quiet-link">← Home</a><h1>Try your own ideas</h1><p>You control both teams using simulated chat. Start with the sample ideas or write your own.</p></div><div class="preparation panel">${artworkChoices('rehearsal', ai, selected)}<button id="begin-rehearsal" class="button primary" ${!enabled || active ? 'disabled' : ''}>Start test</button>${active ? '<p><a href="#encounter">Go back and end the current game first.</a></p>' : ''}</div>`;
  $('begin-rehearsal').onclick = () => actions.start('rehearse', document.querySelector('[name=rehearsal-art]:checked').value);
}
