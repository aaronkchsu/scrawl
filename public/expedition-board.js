import { pixelArt } from './expedition-cave-art.js';
import { createRescueEffects } from './expedition-rescue-ui.js';
import { avatar } from './expedition-avatar.js';
import { createEventEffects } from './expedition-event-effects.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function createBoard(root) {
    root.innerHTML = `<div class="stream-background"><div class="sun"></div><div class="mountain far"></div><div class="mountain near"></div><div class="stream-placeholder"><span class="screen-corners">⌜ &nbsp; &nbsp; ⌝</span><strong>Your stream goes here</strong><span>The game stays around the edges.</span></div><div class="sample-live"><i class="dot"></i> PREVIEW BACKGROUND</div></div><div class="overlay-mode"></div><div class="hype-banner"></div><div class="shaft" hidden><div class="shaft-heading"><span>THE CLIMB</span><b>♛</b></div><div class="rock-wall left"></div><div class="rock-wall right"></div><div class="shaft-rooms">${[6, 5, 4, 3, 2, 1].map(n => `<div class="shaft-room room-${n}"><span class="floor-number">${n}</span><div class="ledge"></div><span class="prop ${n === 3 ? 'cache' : n % 2 ? 'crate' : 'slime'}">${n === 3 ? '✦' : n % 2 ? '' : '• •'}</span></div>`).join('')}</div><div class="climbers"></div><div class="shaft-base">↑ EXCAVATION</div></div><div class="cave-overlay-labels"></div><div class="camp"><div class="camp-line"></div><div class="camp-avatars"></div><div class="camp-sign">!join <span>·</span> !dig</div></div><div class="queue-badge"></div><div class="moment" hidden></div>`;
    const $ = sel => root.querySelector(sel);
    const eventEffects = createEventEffects(root);
    const rescueEffects = createRescueEffects(root);
    let campKey = '', modeKey = '';
    return (state, now = Date.now()) => {
        root.dataset.side = state.settings.side;
        root.style.setProperty('--avatar-size', state.settings.avatarSize);
        const active = state.runs;
        root.classList.toggle('has-climb', active.length > 0);
        $('.shaft').hidden = !active.length;
        const visibleCaves = [...new Map(active.filter(r => r.cave).map(r => [r.cave.id, r.cave])).values()];
        const caveLabels = $('.cave-overlay-labels');
        const caveKey = JSON.stringify(visibleCaves.map(c => c.id));
        if (caveLabels.dataset.key !== caveKey) {
            caveLabels.dataset.key = caveKey;
            caveLabels.innerHTML = visibleCaves.map(c => `<div><small>AI CAVE · ${escapeHtml(c.fromCamp)} → ${escapeHtml(c.toCamp)}</small><b>${escapeHtml(c.name)}</b><span>${escapeHtml(state.caves.rules[c.rule])}</span><small>By ${c.credits.map(cr => escapeHtml(cr.name)).join(', ')}</small></div>`).join('');
        }
        if (modeKey !== state.mode + Boolean(state.practice)) {
            modeKey = state.mode + Boolean(state.practice);
            $('.overlay-mode').textContent = state.practice ? 'SCRIPTED RESCUE PRACTICE' : state.mode === 'demo' ? 'DEMO · SIMULATED VIEWERS' : 'LIVE CHAT';
        }
        const hypes = Object.entries(state.hype).filter(([, h]) => h.expiresAt > now);
        root.classList.toggle('hyped', hypes.length > 0);
        $('.hype-banner').innerHTML = hypes.map(([team, h]) => `<span><b>${h.multiplier}× ORE</b> ${state.mode === 'demo' ? 'SIMULATED · ' : ''}HYPE LV ${h.level} <small>${escapeHtml(state.channels[team].name || `CAMP ${team.toUpperCase()}`)}</small></span>`).join('');
        // Keep existing elements so movement and idle animations survive state updates.
        for (const node of $('.climbers').children)
            if (!active.some(r => r.id === node.dataset.id))
                node.remove();
        active.forEach(r => {
            const p = state.players.find(p => p.id === r.playerId);
            if (!p)
                return;
            let layer = [...$('.climbers').children].find(n => n.dataset.id === r.id);
            if (!layer) {
                layer = document.createElement('div');
                layer.className = 'run-layer';
                layer.dataset.id = r.id;
                layer.innerHTML = `<div class="route-props">${r.rooms.map((room, i) => `<span class="route-prop ${room.kind}${r.cave && ['slime', 'crystal'].includes(room.kind) ? ' ai-prop' : ''}" data-floor="${i + 1}" style="bottom:calc(${8 + i * (82 / 6)}% + .6cqw);left:${21 + r.lane * 29}%">${r.cave && room.kind === 'slime' ? pixelArt(r.cave.enemyPixels, r.cave.enemyName) : r.cave && room.kind === 'crystal' ? pixelArt(r.cave.findPixels, r.cave.findName) : room.kind === 'slime' ? '• •' : room.kind === 'crystal' ? '✦' : room.kind === 'gap' ? '↯' : ''}</span>`).join('')}</div><div class="climber"></div>`;
                $('.climbers').append(layer);
            }
            const node = layer.querySelector('.climber');
            layer.querySelectorAll('.route-prop').forEach(prop => { const n = Number(prop.dataset.floor); prop.classList.toggle('smashed', n === r.floor); prop.classList.toggle('cleared', n < r.floor); });
            node.style.setProperty('--lane', r.lane);
            node.style.bottom = `calc(${r.floor ? 8 + (r.floor - 1) * (82 / 6) : 3}% - .3cqw)`;
            node.dataset.phase = r.phase;
            node.classList.toggle('rescued', Boolean(r.rescue));
            const oldLoot = Number(node.dataset.loot ?? r.loot);
            node.dataset.loot = r.loot;
            const key = JSON.stringify([p.name, p.hue, r.floor, r.phase, r.hp, r.loot, r.multiplier, r.equipped, r.outlook, r.giftRocks, r.rescue, p.keepsakes?.length]);
            if (node.dataset.key !== key) {
                node.dataset.key = key;
                node.innerHTML = `<span class="climber-name">${escapeHtml(p.name)} · ${r.team.toUpperCase()}</span><span class="hearts" aria-label="${r.hp} health">${'♥'.repeat(r.hp)}${'♡'.repeat(3 - r.hp)}</span>${avatar({ ...p, equipped: r.equipped })}<span class="loot-pill">${r.phase === 'lost' ? 'XP kept' : r.rescue ? '↟ Saved · ' : r.phase === 'banked' ? '✓ ' : ''}${r.phase === 'lost' ? '' : r.loot + ' ore'}</span>${r.phase === 'choice' ? '<span class="choice-bubble">!keep / !risk</span>' : ''}${r.multiplier > 1 ? `<b class="run-multiplier">${r.multiplier}×</b>` : ''}`;
                if (r.loot > oldLoot) {
                    const pop = document.createElement('span');
                    pop.className = 'ore-pop';
                    pop.textContent = `+${r.loot - oldLoot} ore${r.multiplier > 1 ? ' · ' + r.multiplier + '×' : ''}`;
                    node.append(pop);
                }
            }
        });
        const resting = state.players.filter(p => !active.some(r => r.playerId === p.id));
        const shown = resting.slice(-32);
        const nextKey = JSON.stringify([active.length > 0, state.rescue.linked, state.rescue.camps, shown.map(p => [p.id, p.team, p.name, p.equipped, p.hue, p.xp, p.keepsakes?.length]), state.queue.map(q => q.playerId)]);
        if (nextKey !== campKey) {
            campKey = nextKey;
            const width = active.length ? 34 : 46;
            $('.camp-avatars').innerHTML = ['a', 'b'].map((team, ti) => {
                const members = shown.filter(p => p.team === team);
                if (!members.length && !state.rescue.linked) return '';
                return `<span class="camp-label" style="left:${2 + ti * width}%">${team.toUpperCase()} · ${escapeHtml(state.rescue.camps[team])}</span>` + members.map((p, i) => `<div class="camp-viewer" data-player="${escapeHtml(p.id)}" style="--position:${5 + ti * width + i * (width - 9) / Math.max(members.length - 1, 1)}%;--delay:${-i * .37}s">${avatar(p)}<span>${escapeHtml(p.name)}<small class="viewer-next"></small><i class="tiny-xp" style="--xp:${p.xp % 100}%"></i></span></div>`).join('');
            }).join('');
        }
        // Update countdown text without replacing avatars and restarting their motion.
        const positions = new Map(state.queue.map((q, i) => [q.playerId, i + 1]));
        for (const node of $('.camp-avatars').querySelectorAll('.camp-viewer')) {
            const p = shown.find(p => p.id === node.dataset.player);
            const next = node.querySelector('.viewer-next');
            const text = positions.has(p.id) ? '#' + positions.get(p.id) + ' queued' : p.digReadyAt > now ? Math.ceil((p.digReadyAt - now) / 1000) + 's rest' : '!dig';
            if (next.textContent !== text) next.textContent = text;
        }
        for (const r of active) {
            const bubble = [...$('.climbers').children].find(n => n.dataset.id === r.id)?.querySelector('.choice-bubble');
            if (bubble) {
                const canSend = state.rescue.linked && !state.rescue.ropes[r.team === 'a' ? 'b' : 'a'] && (state.rescue.readyAt[r.team] ?? 0) <= now;
                bubble.textContent = state.practice && !state.practice.done
                    ? state.practice.role === 'send' ? `Choose Keep\n${r.loot} ore + send rope` : 'Choose Risk\nTry the rescue'
                    : `!keep ${r.loot} · !risk ${r.outlook.summitOre}${canSend ? '\nKeep sends help' : ''}${r.nextAt ? '\n' + Math.max(0, Math.ceil((r.nextAt - now) / 1000)) + 's' : ''}`;
            }
        }
        $('.camp-sign').textContent = state.mode === 'demo' ? 'SIMULATED CAMP' : '!join · !dig';
        $('.queue-badge').textContent = state.queue.length ? `${state.queue.length} waiting · ${state.queue.slice(0, 3).map(q => state.players.find(p => p.id === q.playerId)?.name ?? 'Viewer').join(', ')}` : state.players.length > 32 ? `${state.players.length} viewers in camp` : '';
        const moment = state.events.find(e => / kept |fell!|reached level/.test(e.text) && now - e.at < 6000);
        $('.moment').hidden = !moment;
        if (moment)
            $('.moment').textContent = moment.text;
        eventEffects(state, now);
        rescueEffects(state, now);
    };
}
