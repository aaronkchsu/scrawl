import { createOnboarding } from './expedition-onboarding.js';
import { createCaveUI } from './expedition-cave-ui.js';
import { findCard } from './expedition-cave-art.js';
import { createBoard, escapeHtml } from './expedition-board.js';
import { avatar, explorerFor } from './expedition-avatar.js';
import { request, connectState } from './expedition-connection.js';
import { createHostedSetup } from './expedition-hosted-setup.js';
import { createSetup } from './expedition-setup.js';
import { createRescuePanel, campName, sendHint, rescueHint } from './expedition-rescue-ui.js';
import { createEventControls } from './expedition-event-controls.js';
const $ = id => document.getElementById(id);
let latest, selected = localStorage.getItem('excavation-viewer') || 'demo:noodle', selectionKey = '', controlsKey = '', inventoryKey = '', busy = false, authorized = false, online = false;
const draw = createBoard($('board'));
const drawCaves = createCaveUI($('cave-workshop'), { action, fail, tryCave: async team => {
    const s = latest.state;
    const p = s.players.find(p => p.team === team && (p.digReadyAt ?? 0) <= latest.now && !s.runs.some(r => r.playerId === p.id) && !s.queue.some(q => q.playerId === p.id));
    if (!p) throw new Error('Everyone in this camp is climbing or resting. Try again shortly.');
    selected = p.id; localStorage.setItem('excavation-viewer', selected);
    await action('dig', { playerId: p.id });
    $('board').scrollIntoView({ behavior: 'smooth', block: 'center' });
} });
const drawRescue = createRescuePanel($('rescue-panel'));
function fail(error) { $('error').hidden = false; $('error').textContent = error.message || String(error); }
async function action(name, body = {}) {
    if (!latest)
        throw new Error('Waiting for the server.');
    if (!authorized)
        throw new Error('Unlock host controls in Setup first.');
    if (!online)
        throw new Error('The server is disconnected. Wait for it to reconnect.');
    if (busy)
        throw new Error('Wait for the current action to finish.');
    busy = true;
    $('error').hidden = true;
    try {
        const data = await request('/api/action', { action: name, sessionId: latest.state.id, ...body });
        render(data);
        return data;
    }
    finally {
        busy = false;
    }
}
const config = await fetch('/api/config').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const setup = (config.hosted ? createHostedSetup : createSetup)({ request, action, fail });
const onboarding = createOnboarding({ action, current: () => latest, select: id => { selected = id; localStorage.setItem('excavation-viewer', id); }, fail });
const events = createEventControls({ action, fail, current: () => ({ state: latest.state, player: latest.state.players.find(p => p.id === selected) }) });
function route() {
    const hash = location.hash.slice(1);
    const page = ['setup', 'viewer', 'camp'].includes(hash) ? hash : ['encounter', 'rehearse'].includes(hash) ? 'camp' : 'home';
    for (const name of ['home', 'camp', 'setup', 'viewer']) {
        $(name + '-page').hidden = name !== page;
        $(name + '-link').classList.toggle('active', name === page);
        if (name === page) $(name + '-link').setAttribute('aria-current', 'page');
        else $(name + '-link').removeAttribute('aria-current');
    }
}
window.addEventListener('hashchange', route);
route();
$('player-select').onchange = () => { selected = $('player-select').value; localStorage.setItem('excavation-viewer', selected); render(latest); };
$('rescue-practice').onclick = () => action('rescue-practice').catch(fail);
$('demo-reset').onclick = () => action('demo').catch(fail);
$('run-controls').onclick = event => { const button = event.target.closest('button[data-action]'); if (!button)
    return; button.disabled = true; action(button.dataset.action, { playerId: selected, runId: button.dataset.run, choice: button.dataset.choice }).catch(fail).finally(() => { button.disabled = false; }); };
$('inventory-list').onclick = event => { const button = event.target.closest('button[data-equip]'); if (button)
    action('equip', { playerId: selected, item: button.dataset.equip }).catch(fail); };
$('auth-form').onsubmit = async (event) => { event.preventDefault(); try {
    await request('/api/session', { token: $('host-token').value });
    authorized = true;
    $('host-token').value = '';
    $('host-access').hidden = true;
    $('error').hidden = true;
    render(latest);
}
catch (e) {
    fail(e);
} };
function render(data) {
    if (!data)
        return;
    latest = data;
    if (typeof data.authenticated === 'boolean') authorized = data.authenticated;
    if (data.healthy === false) { online = false; fail(Error('Server interrupted. Climbs are paused. Reconnecting automatically…')); }
    const s = data.state;
    draw(s, data.now);
    drawRescue(s, data.now);
    setup(data, authorized && online);
    const guidedPlayer = onboarding(data, authorized && online);
    if (guidedPlayer) selected = guidedPlayer;
    drawCaves(data, authorized && online);
    $('cave-section').hidden = Boolean(config.hosted && data.practice);
    const demo = s.mode === 'demo';
    $('mode-label').textContent = demo ? 'DEMO · SIMULATED VIEWERS' : 'LIVE · TWITCH VIEWERS';
    $('sim-badge').textContent = demo ? 'SIMULATED' : 'LIVE';
    $('viewer-label').textContent = demo ? 'TEST VIEWER' : 'VIEWER';
    $('demo-reset').hidden = !demo;
    const practice = s.practice;
    $('event-controls').hidden = !demo || Boolean(practice && !practice.done);
    $('practice-launch').hidden = !demo || Boolean(practice) || Boolean(guidedPlayer && s.runs.some(r => r.playerId === guidedPlayer));
    $('rescue-practice').disabled = !authorized || !online;
    $('demo-reset').disabled = !authorized || !online;
    $('demo-reset').textContent = practice ? 'Back to playground ↺' : 'Restart demo ↺';
    $('practice-guide').hidden = !practice;
    if (practice) {
        const run = s.runs.find(r => r.id === practice.runId);
        const name = s.players.find(p => p.id === practice.playerId)?.name;
        const instruction = practice.done ? 'Both camps helped. Find your Linked Lantern in the backpack.' : run?.phase === 'banked' ? run.message : run?.phase === 'climbing' ? 'Watch the rope catch the fall.' : practice.role === 'send' ? `${name}: choose Keep to send a rope.` : `${name}: choose Risk to try the rescue.`;
        $('practice-guide').textContent = `SCRIPTED PRACTICE · ${practice.done ? 'DONE' : (practice.leg * 2 + (practice.role === 'send' ? 1 : 2)) + '/4'} — ${instruction}`;
        if (!practice.done) selected = practice.playerId;
    }
    $('player-select').disabled = Boolean(practice && !practice.done) || Boolean(guidedPlayer && s.runs.some(r => r.playerId === guidedPlayer));
    $('save-status').textContent = s.saveError || (config.hosted && data.practice ? 'Practice saves for this session.' : 'Loot and XP save across streams.');
    if (s.saveError) {
        $('error').hidden = false;
        $('error').replaceChildren(document.createTextNode(s.saveError + ' '));
        const retry = document.createElement('button');
        retry.textContent = 'Retry save';
        retry.onclick = () => action('save').catch(fail);
        $('error').append(retry);
    }
    if (!s.players.some(p => p.id === selected))
        selected = s.players[0]?.id || '';
    const key = JSON.stringify(s.players.map(p => [p.id, p.name, p.team]));
    if (key !== selectionKey) {
        selectionKey = key;
        $('player-select').innerHTML = s.players.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · ${escapeHtml(campName(s, p.team))}</option>`).join('') || '<option>No viewers yet</option>';
    }
    $('player-select').value = selected;
    const p = s.players.find(p => p.id === selected);
    events(s, p, authorized && online);
    $('occupancy').textContent = `${s.runs.length} / ${s.settings.slots} climbing${s.queue.length ? ' · ' + s.queue.length + ' queued' : ''}`;
    $('activity-log').innerHTML = s.events.slice(0, 4).map(e => `<li>${escapeHtml(e.text)}</li>`).join('') || '<li>Camp is ready.</li>';
    if (!p) {
        $('profile-art').hidden = true;
        $('player-name').textContent = 'Waiting for viewers';
        $('player-level').textContent = 'Type !join in Twitch chat';
        $('xp-fill').style.width = '0%';
        $('xp-label').textContent = '';
        $('run-controls').innerHTML = '<p class="empty">The first viewer to type <code>!join</code> appears here.</p>';
        $('inventory-list').innerHTML = '';
        $('keepsakes').innerHTML = '';
        controlsKey = '';
        inventoryKey = '';
        return;
    }
    $('player-name').textContent = p.name;
    $('player-level').textContent = `Level ${1 + Math.floor(p.xp / 100)} · ${p.ore} ore`;
    $('profile-art').hidden = false;
    const portraitKey = `${p.id}:${p.equipped}:${p.keepsakes?.length}`;
    if ($('profile-art').dataset.key !== portraitKey) {
        $('profile-art').dataset.key = portraitKey;
        $('profile-art').innerHTML = avatar(p);
        $('profile-art').setAttribute('aria-label', explorerFor(p).name);
    }
    $('xp-fill').style.width = `${p.xp % 100}%`;
    $('xp-label').textContent = `${p.xp % 100} / 100 XP`;
    const r = s.runs.find(r => r.playerId === p.id);
    const qi = s.queue.findIndex(q => q.playerId === p.id);
    const ckey = JSON.stringify([p.id, r?.id, r?.phase, r?.floor, r?.hp, r?.loot, r?.message, r?.outlook, r?.giftRocks, r?.rescue, r?.cave, s.settings.giftRocks, s.rescue, practice, qi, demo, authorized, online]);
    if (ckey !== controlsKey) {
        controlsKey = ckey;
        const disabled = !demo || !authorized || !online;
        let html = '';
        if (!r && qi < 0)
            html = `<button class="primary large" data-action="dig" ${disabled ? 'disabled' : ''}>Start a climb <span>↑</span></button><p class="hint">${demo ? 'Pick a viewer, then start.' : 'Type !dig in Twitch chat.'}${s.settings.giftRocks ? ' Gift rocks on.' : ''}</p>`;
        else if (!r)
            html = `<div class="run-status"><strong>In the queue · #${qi + 1}</strong><p>Starts when a climbing spot opens.</p></div>`;
        else if (r.phase === 'choice') {
            const item = s.items.find(i => i.id === r.item);
            const next = sendHint(s, r.team, data.now);
            const backup = rescueHint(s, { ...p, team: r.team }, data.now);
            const sendOnly = practice && !practice.done && practice.role === 'send';
            const riskOnly = practice && !practice.done && practice.role === 'receive';
            html = `<div class="choice-card"><span class="eyebrow">CHOOSE · ${r.hp} HP</span><h3>${r.loot} ore + ${escapeHtml(item.name)}</h3><div class="choice-buttons"><button class="primary" ${riskOnly ? 'hidden' : ''} data-action="choose" data-run="${r.id}" data-choice="keep" ${disabled || riskOnly ? 'disabled' : ''}>Keep ${r.loot} ore</button><button class="${riskOnly ? 'primary' : ''}" ${sendOnly ? 'hidden' : ''} data-action="choose" data-run="${r.id}" data-choice="risk" ${disabled || sendOnly ? 'disabled' : ''}>${practice ? 'Risk the climb' : `Risk for ${r.outlook.summitOre}`}</button></div><p class="send-hint" ${riskOnly ? 'hidden' : ''}>${escapeHtml(next)}</p>${backup ? `<p class="rescue-backup">${escapeHtml(backup)}</p>` : ''}<p>${practice ? (riskOnly ? 'A fixed fall shows how the rope works.' : 'Your loot stays yours.') : `${Math.round(r.outlook.survivalChance * 100)}% chance to reach the summit.${r.giftRocks ? ' Gift rocks also on.' : ''}`}</p><details><summary>What’s at risk?</summary><p>A fall loses this climb’s loot unless a partner’s rope catches you. XP and earlier loot stay yours. A rope is shared by the camp, so another climber may use it first.</p><p>Route odds include gear; they exclude gift rocks. No crown for a rescue.</p></details><small>${demo ? 'Waiting for your choice.' : '!keep / !risk · no reply keeps loot after 45s'}</small></div>`;
        }
        else if (r.phase === 'climbing')
            html = `<div class="run-status"><span class="eyebrow">CLIMBING · ROOM ${r.floor} / 6</span><h3>${escapeHtml(r.message)}</h3><p><span class="pink">${'♥'.repeat(r.hp)}</span> ${r.loot} ore in the bag</p><small>${r.floor < 3 ? 'A choice is coming at the crystal cache.' : 'Next stop: the summit.'}</small></div>`;
        else
            html = `<div class="run-status result ${r.phase}"><span class="eyebrow">${r.rescue ? 'RESCUED' : r.phase === 'banked' ? 'LOOT SAVED' : 'BACK TO CAMP'}</span><h3>${escapeHtml(r.message)}</h3><p>${r.phase === 'banked' ? r.loot + ' ore banked · ' : ''}${r.gainedXp} XP earned.</p><small>Returning to camp…</small></div>`;
        if (r?.cave) html = `<div class="run-cave"><small>AI CAVE · FROM ${escapeHtml(r.cave.fromCamp)}</small><strong>${escapeHtml(r.cave.name)}</strong><p>${escapeHtml(s.caves.rules[r.cave.rule])}</p><small>Keep loot to collect ${escapeHtml(r.cave.findName)}.</small></div>` + html;
        const focused = $('run-controls').contains(document.activeElement) ? document.activeElement.dataset.choice : null;
        const detailsOpen = $('run-controls').querySelector('details')?.open;
        $('run-controls').innerHTML = html;
        if (detailsOpen && $('run-controls').querySelector('details')) $('run-controls').querySelector('details').open = true;
        if (focused) $('run-controls').querySelector(`[data-choice="${focused}"]`)?.focus({ preventScroll: true });
    }
    const hint = $('run-controls').querySelector('.send-hint');
    if (hint && r) hint.textContent = sendHint(s, r.team, data.now);
    const ikey = JSON.stringify([p.id, p.inventory, p.equipped, p.keepsakes, p.finds, demo, authorized, online]);
    if (ikey !== inventoryKey) {
        inventoryKey = ikey;
        $('item-count').textContent = `${p.inventory.length} ${p.inventory.length === 1 ? 'item' : 'items'}`;
        $('inventory-list').innerHTML = p.inventory.map(id => { const item = s.items.find(i => i.id === id); return `<button class="item ${p.equipped === id ? 'selected' : ''}" data-equip="${id}" ${!demo || !authorized || !online ? 'disabled' : ''}><span class="item-icon" style="color:${item.color}">${item.icon}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.effect)}</small></span><span class="equip-state">${p.equipped === id ? 'ON' : 'Equip'}</span></button>`; }).join('') || '<div class="empty">Keep loot to collect gear.</div>';
        $('keepsakes').innerHTML = (p.keepsakes ?? []).map(k => `<details class="keepsake"><summary>♧ Linked Lantern</summary><p>${k.camps.map(escapeHtml).join(' + ')}</p><p>${k.people.map(person => escapeHtml(person.name)).join(' · ')}</p><small>Saved each other. Cosmetic only.</small></details>`).join('') + (p.finds ?? []).map(findCard).join('');
    }
}
function listen() {
    connectState(render, connected => {
        online = connected;
        $('connection').textContent = connected ? 'Server connected' : 'Reconnecting… ';
        if (!connected) {
            const retry = document.createElement('button'); retry.className = 'quiet'; retry.textContent = 'Reload'; retry.onclick = () => location.reload(); $('connection').append(retry);
        }
        $('connection').classList.toggle('offline', !connected); if (latest) render(latest);
    });
}
request('/api/session', {}).then(data => {
    authorized = true;
    if (data.state) render(data);
    listen();
}).catch(() => {
    $('host-access').hidden = false;
    fail(new Error(config.hosted ? 'Could not connect. Refresh to try again.' : 'Host controls are locked. Open Set up stream to unlock them.'));
    listen();
});
