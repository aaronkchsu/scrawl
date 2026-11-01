export { esc } from './doodles.js';
export const $ = id => document.getElementById(id);
export function saveDraft(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function loadDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}
export function artworkChoices(prefix, ai, value = 'demo') {
  if (value === 'ai' && (!ai.configured || ai.maxRequests - ai.requests < 2)) value = 'demo';
  return `<fieldset class="artwork-choice"><legend>Which drawings?</legend>
    <label><input type="radio" name="${prefix}-art" value="demo" ${value === 'demo' ? 'checked' : ''}><span><strong>Sample drawings · free</strong><small>Premade ducks, frogs, cats, and robots. Limited to these shapes.</small></span></label>
    <label><input type="radio" name="${prefix}-art" value="ai" ${value === 'ai' ? 'checked' : ''} ${!ai.configured || ai.maxRequests - ai.requests < 2 ? 'disabled' : ''}><span><strong>AI drawings · paid</strong><small>${!ai.configured ? 'No API key set. See Developer tools below.' : ai.maxRequests - ai.requests < 2 ? 'Not enough calls left. Use sample drawings.' : `${ai.maxRequests - ai.requests} calls left. Uses 2 per round, 4 per game.`}</small></span></label>
  </fieldset>`;
}
