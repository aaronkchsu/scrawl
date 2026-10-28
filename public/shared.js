import { stageSVG, esc } from './doodles.js';
let lastDrawing = '';
function ballot(team, phase) {
  const selected = team.finalists.find(f => f.id === team.selectedId);
  return `<section class="ballot" style="--team-color:${team.color}"><div class="ballot-heading"><span class="team-caption">${esc(team.name)}</span><span>${team.voterCount} voters · ${team.nominationCount} nominees</span></div><p class="ballot-rule">${phase === 'voting' ? 'Choose the lead. Other finalists add visual details.' : selected ? `${esc(selected.approach.label)} · ${selected.approach.impact} impact${selected.approach.defense ? ' · blocks 12' : ''}. The vote is locked.` : 'No nomination submitted.'}</p><div class="finalist-list">${team.finalists.map(f => {
    const share = team.voterCount ? Math.round(100 * f.votes / team.voterCount) : 0;
    return `<article class="finalist ${f.id === team.selectedId ? 'selected-finalist' : ''}"><div class="finalist-top"><strong>${f.id === team.selectedId ? 'LEAD IDEA' : `!vote ${f.id}`}</strong><span>${phase === 'voting' ? `${share}%` : f.id === team.selectedId ? 'DRAWING THIS' : 'ADDS A DETAIL'}</span></div><p title="${esc(f.message.text)}">${esc(f.message.text)}</p><div class="finalist-meta"><span>${esc(f.message.name)}</span><span>${esc(f.approach.label)} · ${f.approach.impact} impact</span></div>${phase === 'voting' ? `<div class="vote-track"><span style="width:${share}%"></span></div>` : ''}</article>`;
  }).join('') || '<p class="muted">A blank page. No finalists this round.</p>'}</div></section>`;
}
export function selectionBoard(state, perspective) {
  const other = perspective === 'a' ? 'b' : 'a';
  return `<div class="selection-board"><div class="selection-heading"><strong>${state.phase === 'voting' ? 'TWO CHATS. ONE PENCIL EACH.' : 'THE RECIPE IS LOCKED.'}</strong><span>${state.phase === 'voting' ? 'One active vote per viewer. No votes or a tie? Random draw.' : 'Your chosen ideas stay here while the artwork draws. Both communities wait.'}</span></div><div class="ballot-grid">${ballot(state.teams[perspective], state.phase)}${ballot(state.teams[other], state.phase)}</div><p class="selection-footnote">Same power budget for both communities. Finalists are sampled from up to 12 unique nominees per team.</p></div>`;
}
export function renderBoard(state, now, perspective = 'a') {
  const titles = { lobby: ['TWO COMMUNITIES · ONE SHARED MONSTER','Your community holds the pencil.'], building: ['NOMINATE · ONE IDEA PER VIEWER',state.boss.cue], voting: ['ONE SHORT VOTE · SAME POWER BUDGET','Choose your community’s lead idea.'], generating: ['VOTE LOCKED · PENCILS AT WORK','Drawing the collective imagination…'], reveal: ['THE BIG REVEAL','Your votes. Their details. One invention.'], resolving: ['LET’S SEE IF THIS WORKS','Two inventions. One shared threat.'], finishing: ['BOTH COMMUNITIES · ONE FINISHING MOVE','The collective finisher!'], finished: ['THE NOTEBOOK HAS SPOKEN', state.winner === 'boss' ? 'The Inkling demands a rematch.' : 'Two communities. One shared victory.'] };
  const [kicker, title] = titles[state.phase];
  document.getElementById('phase-kicker').textContent = state.paused ? `PAUSED · ${kicker}` : kicker;
  document.getElementById('phase-title').textContent = state.error ? 'The recipe is saved. Both teams wait.' : title;
  const remaining = state.paused ? state.remainingMs : state.deadline ? Math.max(0,state.deadline-now) : 0;
  const seconds = Math.ceil(remaining/1000);
  const countdown = document.getElementById('countdown'); countdown.textContent = state.paused ? 'Ⅱ' : remaining ? `${seconds}s` : state.phase === 'finished' ? '✓' : '✎'; countdown.classList.toggle('urgent', seconds > 0 && seconds <= 5);
  document.getElementById('boss-health').style.width = `${100*state.boss.health/state.boss.maxHealth}%`;
  document.getElementById('boss-hp').textContent = `${state.boss.health} / ${state.boss.maxHealth}`;
  const commands = state.approaches.map(a => `${a.id} (${a.impact}${a.defense ? ', block 12' : ''})`).join(' / ');
  document.getElementById('instruction').textContent = state.phase === 'lobby' ? 'Nominate → vote → invent → defeat the shared boss together.' : state.phase === 'building' ? `!idea counter your invention · ${commands}.` : state.phase === 'voting' ? 'Type !vote 1, !vote 2, or !vote 3 in YOUR chat. You can change your vote; repeating it adds nothing.' : state.phase === 'reveal' ? 'Nominees: type !brace to help your community withstand the next hit.' : state.phase === 'generating' ? 'Art takes a moment. The winning counter is fixed; chat size never multiplies its power.' : state.phase === 'finishing' ? state.finisher.components.map(c => `${state.teams[c.team].name}: ${c.name}`).join(' + ') : state.phase === 'finished' ? 'Both communities’ inventions, credits, and result are visible on this stream.' : state.log.at(-1)?.text ?? '';
  if (state.experience === 'rehearsal') {
    document.getElementById('instruction').textContent = { building: 'Rehearsal · simulated viewers. The host is preparing both communities’ ideas.', voting: 'Rehearsal · one simulated vote per community. Waiting for the host.', generating: 'Rehearsal · drawing from simulated contributions. Both communities wait.', reveal: 'Rehearsal · inspect the drawings. The fight starts when the host is ready.' }[state.phase] ?? 'Rehearsal · simulated participants. The same combat rules apply.';
    if (!state.deadline && !state.error && ['building','voting','reveal'].includes(state.phase)) countdown.textContent = '✎';
  }
  const mode = document.getElementById('mode-label'); mode.textContent = state.phase === 'lobby' ? 'READY TO START' : `${state.experience === 'rehearsal' ? 'REHEARSAL · SIMULATED' : state.experience === 'demo' ? 'SCRIPTED DEMO' : 'TWITCH'} · ${state.mode === 'ai' ? 'AI ART' : 'SAMPLE ART'}`; mode.classList.toggle('ai',state.mode==='ai');
  document.body.classList.toggle('paused',state.paused);
  const selection = ['voting','generating'].includes(state.phase);
  const signature = JSON.stringify([perspective,state.id,state.phase,state.round,state.winner,state.boss.health,...Object.values(state.teams).map(t=>[t.creation,t.name,t.score,selection?t.finalists:null,selection?t.voterCount:null,selection?t.selectedId:null]),state.finisher]);
  if(signature!==lastDrawing){const stage=document.getElementById('battle-stage');stage.classList.toggle('selecting',selection);stage.innerHTML=selection?selectionBoard(state,perspective):stageSVG(state,perspective);lastDrawing=signature;}
}
