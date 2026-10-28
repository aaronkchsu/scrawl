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
    box.innerHTML = `<div class="editor-heading"><h2>What should each community invent?</h2><p>Edit these sample messages. Choose how each invention counters the monster.</p><small id="draft-status">Edits stay in this browser tab when you refresh.</small></div><div class="rehearsal-teams">${['a','b'].map(team => `<section class="editor-team" style="--team-color:${s.teams[team].color}"><h3>${team === 'a' ? 'Orange' : 'Blue'} community</h3><span class="sample-label">SIMULATED VIEWERS</span>${currentDraft[team].map((row, i) => `<div class="idea-row"><label for="idea-${team}-${i}">${esc(row.name)} <span>· sample viewer ${i + 1}</span></label><textarea id="idea-${team}-${i}" rows="2" maxlength="280" ${!enabled ? 'disabled' : ''}>${esc(row.text)}</textarea><label class="counter-label" for="counter-${team}-${i}">Counter</label><select id="counter-${team}-${i}" ${!enabled ? 'disabled' : ''}>${s.approaches.map(a => `<option value="${esc(a.id)}" ${a.id === row.approach ? 'selected' : ''}>${esc(a.label)} · ${a.impact} impact${a.defense ? `, blocks ${a.defense}` : ''}</option>`).join('')}</select></div>`).join('')}</section>`).join('')}</div>`;
    box.oninput = () => {
      currentDraft = readEditor();
      $('draft-status').textContent = saveDraft(draftKey, currentDraft) ? 'Edits saved in this browser tab.' : 'Browser storage is unavailable. Keep this tab open to retain edits.';
    };
  } else {
    box.oninput = null;
    box.innerHTML = `<div class="editor-heading"><h2>Choose each community’s lead idea.</h2><p>Click one card per side. The other finalists still contribute visual details. You can change your vote.</p></div><div class="rehearsal-teams">${['a','b'].map(team => `<section class="editor-team" style="--team-color:${s.teams[team].color}"><h3>${team === 'a' ? 'Orange' : 'Blue'} community</h3><span class="sample-label">ONE SIMULATED VOTER</span>${s.teams[team].finalists.map(f => `<button class="vote-card ${f.votes ? 'chosen' : ''}" data-team="${team}" data-finalist="${f.id}" aria-pressed="${f.votes > 0}" ${!enabled ? 'disabled' : ''}><span class="vote-card-status">${f.votes ? '✓ Your vote' : 'Choose this idea'}</span><strong>${esc(f.message.text)}</strong><span>${esc(f.message.name)} · simulated</span><small>${esc(f.approach.label)} · ${f.approach.impact} impact</small></button>`).join('')}</section>`).join('')}</div>`;
    box.onclick = event => { const b = event.target.closest('[data-finalist]'); if (b) actions.rehearsal('vote', {team:b.dataset.team, finalist:b.dataset.finalist}); };
  }
}
export function submitIdeas(actions) {
  const ideas = readEditor();
  if (ideas) { saveDraft(draftKey, ideas); return actions.rehearsal('ideas', {ideas}); }
}
export function stepContent(payload) {
  const s = payload.state, ai = payload.capabilities.ai;
  const isRehearsal = s.experience === 'rehearsal';
  const needed = Object.values(s.teams).filter(t => t.finalists.length).length;
  const remaining = Math.max(0, ai.maxRequests - ai.requests);
  const canDraw = s.mode !== 'ai' || remaining >= needed;
  const drawLabel = s.mode === 'ai' ? `Draw both with AI · ${needed} API calls` : 'Draw both · free sample art';
  if (s.error) return {title:'Your ideas are safe.', text:s.error, label:s.mode === 'ai' ? `Retry drawing · up to ${needed} API calls` : 'Retry drawing', action:'retry', disabled:!canDraw, note:canDraw ? 'Retry uses the same voted ideas. You can also end this encounter.' : 'No calls will be made. End this encounter and choose free sample artwork.'};
  if (s.phase === 'finished') return {title:s.winner === 'boss' ? 'Try another idea?' : 'You out-doodled it!', text:'Both communities’ drawings and contributions stay on screen until you start again or go home.', label:isRehearsal ? 'Rehearse again' : s.experience === 'demo' ? 'Watch again' : 'Set up next encounter', action:'again', note:'The collective finisher uses the existing artwork. No extra AI call.'};
  if (!isRehearsal) return {title:s.experience === 'demo' ? 'Sit back. Chat has this.' : 'Your chats are playing.', text:s.experience === 'demo' ? 'This scripted example handles both communities’ ideas, votes, and fight. It uses free sample artwork.' : 'Both channels see this encounter. Viewers nominate, vote, and brace through Twitch chat.', label:s.paused ? 'Resume encounter' : 'Pause encounter', action:'pause', disabled:!['building','voting','reveal','resolving','finishing'].includes(s.phase), note:s.experience === 'demo' ? 'Want to change the ideas? Finish or end this demo, then open a rehearsal.' : 'Timers advance automatically. Both communities wait for AI drawings.'};
  if (s.phase === 'building') return {title:'1. Prepare both communities', text:s.boss.cue, label:'Open voting →', action:'ideas', note:'No countdown. Edit the six sample messages, then continue. Blank or duplicate ideas will be highlighted in the error message.'};
  if (s.phase === 'voting') return {title:'2. Choose the lead ideas', text:'One simulated vote per community. Each lead sets the counter; the other finalists add details.', label:drawLabel, action:'draw', disabled:!canDraw || Object.values(s.teams).some(t=>!t.voterCount), note:!canDraw ? `This round needs ${needed} API calls; ${remaining} remain. End this encounter and choose free sample artwork.` : s.mode === 'ai' ? `${remaining} API calls remain in your limit. Drawing starts only when you click. Failures may still use calls.` : 'Free artwork supports ducks, robots, cats, frogs, and a small set of equipment.'};
  if (s.phase === 'generating') return {title:'3. Drawing your ideas…', text:'Both communities wait while the drawings are prepared. You don’t need to click again.', label:'Drawing…', disabled:true, note:'The chosen recipes stay on the board. The reveal will wait for you.'};
  if (s.phase === 'reveal') return {title:'4. Inspect your inventions', text:'Find each sample viewer’s contribution below the drawings. Ready to see if they work?', label:'Play fight →', action:'fight', note:'This plays combat automatically. The next round’s idea editor will wait for you.'};
  return {title:'5. Let them fight!', text:'The counters determine impact. Extra votes never multiply power.', label:s.paused ? 'Resume fight' : 'Pause fight', action:'pause', note:'Combat and the shared finisher play automatically.'};
}
