import { resultTitle, resultExplanation } from './race.js';
import { $, esc, loadDraft, saveDraft } from './ui.js';
let editorKey = '', draftKey = '', currentDraft = null;
function readEditor() {
  if (!currentDraft) return null;
  return Object.fromEntries(['a', 'b'].map(team => [team, currentDraft[team].map((row, index) => ({ ...row, text: $(`idea-${team}-${index}`).value, approach: $(`counter-${team}-${index}`).value }))]));
}
export function renderRehearsal(payload, enabled, actions) {
  const s = payload.state, box = $('rehearsal-editor');
  const visible = s.experience === 'rehearsal' && ['building', 'voting'].includes(s.phase);
  box.hidden = !visible;
  if (!visible) { editorKey = ''; return; }
  const key = JSON.stringify([s.id, s.round, s.phase, enabled, s.phase === 'voting' ? s.teams : null]);
  if (key === editorKey) return;
  editorKey = key;
  if (s.phase === 'building') {
    draftKey = `scrawl-rehearsal-v1-${s.id}-${s.round}`;
    const saved = loadDraft(draftKey);
    currentDraft = saved && ['a','b'].every(t => Array.isArray(saved[t]) && saved[t].length === 3 && saved[t].every(r => typeof r.text === 'string' && typeof r.name === 'string' && s.approaches.some(a => a.id === r.approach))) ? saved : Object.fromEntries(['a','b'].map(t => [t, payload.rehearsalPresets.filter(row => row.team === t).map(({name,text,approach}) => ({name,text,approach}))]));
    box.innerHTML = `<div class="editor-heading"><h2>Edit the ideas</h2><p>Keep the samples or change them. The attack below each idea sets its damage.</p><small id="draft-status">Saved in this tab as you type.</small></div><div class="rehearsal-teams">${['a','b'].map(team => `<section class="editor-team" style="--team-color:${s.teams[team].color}"><h3>${team === 'a' ? 'Orange' : 'Blue'} team</h3><span class="sample-label">SIMULATED CHAT</span>${currentDraft[team].map((row, i) => `<div class="idea-row"><label for="idea-${team}-${i}">${esc(row.name)}</label><textarea id="idea-${team}-${i}" rows="2" maxlength="280" ${!enabled ? 'disabled' : ''}>${esc(row.text)}</textarea><label class="counter-label" for="counter-${team}-${i}">Attack</label><select id="counter-${team}-${i}" ${!enabled ? 'disabled' : ''}>${s.approaches.map(a => `<option value="${esc(a.id)}" ${a.id === row.approach ? 'selected' : ''}>${esc(a.label)} · ${a.impact} damage${a.defense ? `, blocks ${a.defense}` : ''}</option>`).join('')}</select></div>`).join('')}</section>`).join('')}</div>`;
    box.oninput = () => {
      currentDraft = readEditor();
      $('draft-status').textContent = saveDraft(draftKey, currentDraft) ? 'Saved in this tab.' : 'Couldn’t save edits. Keep this tab open.';
    };
  } else {
    box.oninput = null;
    box.innerHTML = `<div class="editor-heading"><h2>Pick one idea per team</h2><p>Your pick becomes the fighter. The other two ideas add details.</p></div><div class="rehearsal-teams">${['a','b'].map(team => `<section class="editor-team" style="--team-color:${s.teams[team].color}"><h3>${team === 'a' ? 'Orange' : 'Blue'} team</h3><span class="sample-label">SIMULATED VOTE</span>${s.teams[team].finalists.map(f => `<button class="vote-card ${f.votes ? 'chosen' : ''}" data-team="${team}" data-finalist="${f.id}" aria-pressed="${f.votes > 0}" ${!enabled ? 'disabled' : ''}><span class="vote-card-status">${f.votes ? '✓ Picked' : 'Pick this'}</span><strong>${esc(f.message.text)}</strong><span>${esc(f.message.name)}</span><small>${esc(f.approach.label)} · ${f.approach.impact} damage</small></button>`).join('')}</section>`).join('')}</div>`;
    box.onclick = event => { const b = event.target.closest('[data-finalist]'); if (b) actions.rehearsal('vote', {team:b.dataset.team, finalist:b.dataset.finalist}); };
  }
}
export function submitIdeas(actions) {
  const ideas = readEditor();
  if (ideas) { saveDraft(draftKey, ideas); return actions.rehearsal('ideas', {ideas}); }
}
export function stepContent(payload) {
  const s = payload.state, ai = payload.capabilities.ai;
  const isTest = s.experience === 'rehearsal';
  const needed = Object.values(s.teams).filter(t => t.finalists.length).length;
  const remaining = Math.max(0, ai.maxRequests - ai.requests);
  const canDraw = s.mode !== 'ai' || remaining >= needed;
  const drawLabel = s.mode === 'ai' ? `Draw fighters · ${needed} paid API calls` : 'Draw fighters · free';
  if (s.error) return {title:'Drawing failed', text:s.error, label:s.mode === 'ai' ? `Retry · up to ${needed} paid API calls` : 'Retry drawing', action:'retry', disabled:!canDraw, note:canDraw ? 'Your picks are saved. Retrying may use more calls.' : 'Not enough calls left. End this test and choose sample drawings.'};
  if (s.phase === 'finished') return {title:resultTitle(s), text:resultExplanation(s), label:isTest ? 'Try again' : s.experience === 'demo' ? 'Watch again' : 'New game', action:'again'};
  if (!isTest) return {title:s.paused ? 'Paused' : s.experience === 'demo' ? 'Demo playing' : 'Game running', text:s.experience === 'demo' ? 'Ideas, votes, and fights are automatic. Nothing to click.' : 'Both Twitch chats are playing. Each step runs on a timer.', label:s.paused ? 'Resume' : 'Pause', action:'pause', disabled:!['building','voting','reveal','resolving','finishing'].includes(s.phase)};
  if (s.phase === 'building') return {title:'Edit, then pick', text:s.round === 2 ? 'Both bosses use lightning this round. Give your fighters a new attack.' : 'Each boss throws ink. Pick how each idea handles it.', label:'Next: pick ideas', action:'ideas', note:'You can leave the samples as they are.'};
  if (s.phase === 'voting') {
    const missing = Object.values(s.teams).filter(t=>!t.voterCount).map(t=>t.id === 'a' ? 'orange' : 'blue');
    return {title:missing.length ? 'Pick a card on each side' : 'Ready to draw', text:missing.length ? `Still need a pick for ${missing.join(' and ')}.` : 'You can change either pick before drawing.', label:drawLabel, action:'draw', disabled:!canDraw || missing.length > 0, note:!canDraw ? `${needed} API calls needed; ${remaining} left. End this test to switch to free drawings.` : s.mode === 'ai' ? `${remaining} API calls left. Nothing is spent until you click.` : 'Uses premade shapes. No API calls.'};
  }
  if (s.phase === 'generating') return {title:'Drawing…', text:'Your fighters will appear here when they’re ready.', label:'Drawing…', disabled:true};
  if (s.phase === 'reveal') return {title:'Ready to fight', text:'Both drawings are ready. Start whenever you want.', label:'Start fight', action:'fight'};
  return {title:'Fighting…', text:Object.values(s.teams).some(t=>t.boss.health===0) ? 'A boss is down. The result is next.' : s.round < s.maxRounds ? 'Round 2 is next. It will wait for you.' : 'The result is next.', label:s.paused ? 'Resume' : 'Pause', action:'pause'};
}
