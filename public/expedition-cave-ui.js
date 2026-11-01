import { escapeHtml as esc } from './expedition-board.js';
import { pixelArt } from './expedition-cave-art.js';
import { campName } from './expedition-rescue-ui.js';

export function createCaveUI(root, { action, fail, tryCave }) {
    let latest, enabled = false, pending = false, readyKey = '', formKey = '', localError = '';
    root.innerHTML = `<div class="cave-heading"><h2>Chat makes the cave</h2><span>IDEAS → CAVE → YOUR FIND</span></div><p>Mix three ideas. Climb the result. Keep what you find.</p><form id="cave-form"><label class="cave-source">Ideas from <select aria-label="Ideas from camp"><option value="a">Camp A</option><option value="b">Camp B</option></select></label><span class="cave-destination"></span><div class="cave-inputs"></div><div class="cave-actions"><button type="submit" class="primary">Create cave · 1 AI request</button><button type="button" class="cave-retry" hidden>Retry saved ideas · 1 request</button></div></form><p class="cave-status" role="status" aria-live="polite"></p><div class="cave-ready"></div><details class="cave-help"><summary>How chat helps</summary><p>Type <code>!idea bees</code>. One idea per viewer; a new one replaces it. Copied ideas count once. The host creates a cave from up to six randomly selected ideas. Used ideas clear after a successful cave.</p><p>Two camps build each other’s caves. One channel builds its own. AI combines the ideas, draws pixel art, and picks one of three fixed route rules. It does not train on viewers or change the odds mid-climb.</p></details>`;
    const form = root.querySelector('form'), select = form.querySelector('select'), inputs = root.querySelector('.cave-inputs');
    const status = root.querySelector('.cave-status'), create = form.querySelector('[type=submit]'), retry = root.querySelector('.cave-retry');
    const storageKey = () => `excavation-cave-ideas-${select.value}`;
    function drafts() {
        try { const v = JSON.parse(localStorage.getItem(storageKey())); if (Array.isArray(v) && v.length === 3 && v.every(t => typeof t === 'string')) return v; } catch {}
        return select.value === 'a' ? ['bees', 'ice', 'a broken toaster'] : ['mushrooms', 'a sleepy robot', 'lost socks'];
    }
    inputs.oninput = () => { try { localStorage.setItem(storageKey(), JSON.stringify([...inputs.querySelectorAll('input')].map(i => i.value))); } catch {} };
    select.onchange = () => { formKey = ''; localError = ''; render(latest, enabled); };
    async function generate(isRetry) {
        if (pending) return;
        pending = true;
        localError = '';
        render(latest, enabled);
        try {
            if (!isRetry && latest.state.mode === 'demo') await action('cave-ideas', { team: select.value, ideas: [...inputs.querySelectorAll('input')].map(i => i.value) });
            await action('cave-generate', { team: select.value, retry: isRetry });
        } catch (error) { localError = error.message || 'Could not create the cave. Try again.'; }
        finally { pending = false; render(latest, enabled); }
    }
    form.onsubmit = event => { event.preventDefault(); void generate(false); };
    retry.onclick = () => void generate(true);
    root.querySelector('.cave-ready').onclick = event => { const b = event.target.closest('[data-try-cave]'); if (b) tryCave(b.dataset.tryCave).catch(fail); };
    function render(data, canAct) {
        if (!data?.state.caves) return;
        latest = data; enabled = canAct;
        const s = data.state, demo = s.mode === 'demo', c = s.caves, ai = data.capabilities.ai;
        if (data.capabilities.hosted && data.account) select.value = data.account.team;
        const team = select.value, target = s.rescue.linked ? team === 'a' ? 'b' : 'a' : team;
        const job = c.job?.batch.source === team ? c.job : null;
        const drawing = c.job?.status === 'drawing', practice = s.practice && !s.practice.done;
        const left = Math.max(0, (ai?.maxRequests ?? 0) - (ai?.requests ?? 0));
        const allowance = `${left} AI request${left === 1 ? '' : 's'} left`;
        const available = p => (p.digReadyAt ?? 0) <= data.now && !s.runs.some(r => r.playerId === p.id) && !s.queue.some(q => q.playerId === p.id);
        root.hidden = Boolean(practice);
        select.disabled = drawing || pending || Boolean(data.capabilities.hosted);
        for (const option of select.options) option.textContent = campName(s, option.value);
        root.querySelector('.cave-destination').textContent = `→ For ${campName(s, target)}${demo ? ' · simulated viewers' : ''}`;
        const key = JSON.stringify([team, demo, demo ? s.players.filter(p => p.team === team).slice(0, 3).map(p => p.name) : c.pools[team]]);
        if (key !== formKey) {
            formKey = key;
            const names = s.players.filter(p => p.team === team).slice(0, 3).map(p => p.name), values = drafts();
            inputs.innerHTML = demo ? values.map((v, i) => `<label>${esc(names[i] || 'Viewer')} <small>SIMULATED</small><input required maxlength="160" aria-label="Idea from ${esc(names[i] || 'viewer')}" value="${esc(v)}"></label>`).join('') : `<p class="cave-live-ideas">${c.pools[team].length ? c.pools[team].slice(0, 6).map(i => `<span><b>${esc(i.name)}</b>: ${esc(i.text)}</span>`).join('') : 'Waiting for ideas. Viewers type !idea followed by a few words.'}</p>`;
        }
        inputs.querySelectorAll('input').forEach(i => { i.disabled = drawing || pending; });
        create.disabled = retry.disabled = !canAct || pending || drawing || !ai?.configured || left === 0 || Boolean(practice) || (!demo && s.channels[team].status !== 'connected');
        create.textContent = drawing ? 'Making cave…' : 'Create cave · 1 AI request';
        retry.hidden = job?.status !== 'error';
        status.textContent = !canAct ? 'Reconnect or unlock host controls in Setup.' : !ai?.configured ? (data.capabilities.hosted ? 'AI caves are not enabled for this account. Built-in caves are ready to play.' : 'AI is not connected. Add the server API key, then restart.') : drawing ? 'Drawing the cave and its find. You can keep playing.' : localError ? localError : job?.status === 'error' ? `${job.error} ${allowance}.` : left === 0 ? 'AI cap reached. You can still play existing caves.' : `${allowance}. Normal climbs are free.`;
        const rkey = JSON.stringify([c.ready, demo, canAct, s.players.map(p => [p.id, p.team, available(p)])]);
        if (rkey !== readyKey) {
            readyKey = rkey;
            root.querySelector('.cave-ready').innerHTML = Object.values(c.ready).map(cave => {
                const hasViewer = s.players.some(p => p.team === cave.target && available(p));
                return `<article class="cave-card"><div class="cave-card-art">${pixelArt(cave.enemyPixels, cave.enemyName)}${pixelArt(cave.findPixels, cave.findName)}</div><div><small>AI CAVE · ${esc(cave.fromCamp)} → ${esc(cave.toCamp)}</small><h3>${esc(cave.name)}</h3><p>${esc(c.rules[cave.rule])}</p><p class="cave-prize">Keep loot → ${esc(cave.findName)}</p><details><summary>Made from ${cave.credits.length} viewers’ ideas</summary>${cave.credits.map(cr => `<p><b>${esc(cr.name)}</b> · ${esc(cr.idea)}<br><small>${esc(cr.feature)}</small></p>`).join('')}</details>${demo ? `<button class="primary" data-try-cave="${cave.target}" ${!canAct || !hasViewer ? 'disabled' : ''}>Try ${esc(cave.toCamp)}’s cave ↓</button>` : `<p>Ready for ${esc(cave.toCamp)}. Type <code>!dig</code>.</p>`}</div></article>`;
            }).join('');
        }
    }
    return render;
}
