import { esc } from './doodles.js';
import { battleScene } from './battle.js';
import { bossMeters, resultTitle, resultExplanation, teamOrder } from './race.js';
let lastDrawing = '', lastMeters = '';
function ballot(team, phase, live) {
  const selected = team.finalists.find(f => f.id === team.selectedId);
  return `<section class="ballot" style="--team-color:${team.color}"><div class="ballot-heading"><span class="team-caption">${esc(team.name)}</span><span>${team.voterCount} votes · ${team.nominationCount} ideas</span></div><p class="ballot-rule">${phase === 'voting' ? 'The top pick becomes the fighter. The others add details.' : selected ? `${esc(selected.approach.label)} · ${selected.approach.impact} damage${selected.approach.defense ? ' · blocks 12' : ''}. Pick saved.` : 'No ideas yet.'}</p><div class="finalist-list">${team.finalists.map(f => {
    const share = team.voterCount ? Math.round(100 * f.votes / team.voterCount) : 0;
    return `<article class="finalist ${f.id === team.selectedId ? 'selected-finalist' : ''}"><div class="finalist-top"><strong>${f.id === team.selectedId ? 'PICKED' : `${phase === 'voting' && live ? '!vote' : 'IDEA'} ${f.id}`}</strong><span>${phase === 'voting' ? `${share}%` : f.id === team.selectedId ? 'DRAWING THIS' : 'ADDS A DETAIL'}</span></div><p title="${esc(f.message.text)}">${esc(f.message.text)}</p><div class="finalist-meta"><span>${esc(f.message.name)}</span><span>${esc(f.approach.label)} · ${f.approach.impact} damage</span></div>${phase === 'voting' ? `<div class="vote-track"><span style="width:${share}%"></span></div>` : ''}</article>`;
  }).join('') || '<p class="muted">No ideas this round.</p>'}</div></section>`;
}
export function selectionBoard(state, perspective) {
  const other = perspective === 'a' ? 'b' : 'a';
  return `<div class="selection-board"><div class="selection-heading"><strong>${state.phase === 'voting' ? 'Picking a fighter' : 'Drawing these ideas'}</strong><span>${state.phase === 'voting' ? 'One vote per viewer. Ties are picked at random.' : 'The picked idea leads. The others add details.'}</span></div><div class="ballot-grid">${ballot(state.teams[perspective], state.phase, state.experience === 'live')}${ballot(state.teams[other], state.phase, state.experience === 'live')}</div></div>`;
}
export function renderBoard(state, now, perspective = 'a', hostControls = false) {
  const titles = {
    lobby: 'Ready to play', building: 'Chat is sending ideas', voting: 'Chat picks one idea per team',
    generating: 'Drawing the fighters…', reveal: 'Meet your fighters', resolving: 'Both fights resolve together',
    finishing: resultTitle(state, hostControls ? null : perspective), finished: resultTitle(state, hostControls ? null : perspective),
  };
  const round = `ROUND ${state.round} OF ${state.maxRounds}`;
  document.getElementById('phase-kicker').textContent = state.paused ? `PAUSED · ${round}` : state.phase === 'lobby' ? 'SCRAWL' : round;
  document.getElementById('phase-title').textContent = state.error ? 'Drawing failed — waiting for retry' : titles[state.phase];
  const remaining = state.paused ? state.remainingMs : state.deadline ? Math.max(0,state.deadline-now) : 0;
  const seconds = Math.ceil(remaining/1000);
  const countdown = document.getElementById('countdown'); countdown.textContent = state.paused ? 'Ⅱ' : remaining ? `${seconds}s` : state.phase === 'finished' ? '✓' : '✎'; countdown.classList.toggle('urgent', seconds > 0 && seconds <= 5);
  const metersKey = JSON.stringify([perspective, hostControls, state.winner, state.teams.a.name, state.teams.b.name, state.teams.a.boss, state.teams.b.boss]);
  if (metersKey !== lastMeters) { document.getElementById('boss-meters').innerHTML = bossMeters(state,perspective,hostControls); lastMeters = metersKey; }
  const live = state.experience === 'live';
  const commands = state.approaches.map(a => a.id).join(' / ');
  const healthSummary = teamOrder(perspective).map(id => `${state.teams[id].name}: boss ${state.teams[id].boss.health} HP`).join(' · ');
  const instructions = {
    lobby: 'Each team has a 70-health boss. Both fights play on this stream.',
    building: live ? `Send !idea counter your idea. Counters: ${commands}.` : state.round === 2 ? 'Both bosses use lightning. Chat suggests new attacks.' : 'Each boss throws ink. Chat suggests ways to stop it.',
    voting: live ? 'Vote in your Twitch chat: !vote 1, !vote 2, or !vote 3.' : 'The top pick becomes the fighter. The other ideas add details.',
    generating: 'Both teams wait for their drawings.',
    reveal: live ? 'Submitted an idea? Type !brace to block some damage.' : state.experience === 'rehearsal' ? hostControls ? 'Click Start fight when you’re ready.' : 'Waiting for the host to start the fight.' : 'The fight starts automatically.',
    resolving: healthSummary,
    finishing: resultExplanation(state),
    finished: resultExplanation(state),
  };
  document.getElementById('instruction').textContent = instructions[state.phase];
  const mode = document.getElementById('mode-label'); mode.textContent = state.phase === 'lobby' ? 'READY TO START' : `${state.experience === 'rehearsal' ? 'TEST · SIMULATED CHAT' : state.experience === 'demo' ? 'SCRIPTED DEMO' : 'TWITCH'} · ${state.mode === 'ai' ? 'AI ART' : 'SAMPLE ART'}`; mode.classList.toggle('ai',state.mode==='ai');
  document.body.classList.toggle('paused',state.paused);
  const selection = ['voting','generating'].includes(state.phase);
  const signature = JSON.stringify([perspective,state.id,state.phase,state.round,state.winner,...Object.values(state.teams).map(t=>[t.creation,t.name,t.score,t.health,t.boss,t.result,selection?t.finalists:null,selection?t.voterCount:null,selection?t.selectedId:null])]);
  if(signature!==lastDrawing){const stage=document.getElementById('battle-stage');stage.classList.toggle('selecting',selection);stage.innerHTML=selection?selectionBoard(state,perspective):battleScene(state,perspective);lastDrawing=signature;}
}
