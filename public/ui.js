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
  return `<fieldset class="artwork-choice"><legend>Choose the drawings</legend>
    <label><input type="radio" name="${prefix}-art" value="demo" ${value === 'demo' ? 'checked' : ''}><span><strong>Sample artwork · free</strong><small>Try the entire flow. Uses a small set of premade doodles.</small></span></label>
    <label><input type="radio" name="${prefix}-art" value="ai" ${value === 'ai' ? 'checked' : ''} ${!ai.configured || ai.maxRequests - ai.requests < 2 ? 'disabled' : ''}><span><strong>AI drawings · paid API calls</strong><small>${!ai.configured ? 'Add OPENAI_API_KEY to this project’s .env and restart the server.' : ai.maxRequests - ai.requests < 2 ? 'Request limit reached. Sample artwork is ready to use.' : 'Original drawings from your ideas. 2 calls per round, 4 for a full encounter.'}</small></span></label>
  </fieldset>`;
}
