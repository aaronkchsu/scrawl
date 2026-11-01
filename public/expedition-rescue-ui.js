const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const other = team => team === 'a' ? 'b' : 'a';
export const campName = (s, team) => s.rescue.camps[team];
export function sendHint(s, team, now) {
    if (!s.rescue.linked) return 'Loot stays yours.';
    const to = other(team), rope = s.rescue.ropes[to];
    if (rope) return `${campName(s, to)} already has a rope.`;
    const seconds = Math.ceil(((s.rescue.readyAt[team] ?? 0) - now) / 1000);
    return seconds > 0 ? `Next rope in ${seconds}s.` : `Keep also sends a rope to ${campName(s, to)}.`;
}
export function rescueHint(s, player, now) {
    const rope = s.rescue.ropes[player.team];
    if (!s.rescue.linked || !rope || rope.donor.id === player.id) return '';
    return now < rope.arrivesAt ? 'Rescue rope on the way.' : `${rope.donor.name}’s rope can save your loot on a fall.`;
}
export function createRescuePanel(root) {
    root.innerHTML = '<div class="rescue-title"><h2>Rescue line</h2><span></span></div><p class="rescue-intro"></p><div class="rescue-routes"></div><p class="rescue-news" role="status"></p><details><summary>How ropes work</summary><p>Choose Keep to bank your loot and send a rope. It catches the other camp’s next fatal fall, then brings that viewer home with their loot.</p><p>One rope per camp. One send per minute. Hype adds 5 ore to the rescue. Help once each way to earn a shared Linked Lantern. A timed-out choice keeps loot but sends no rope.</p></details>';
    return (s, now) => {
        const line = s.rescue;
        const count = Object.keys(line.helped).length;
        root.querySelector('.rescue-title span').textContent = line.linked ? `${count}/2 rescues${line.keepsake ? ' · Lantern earned' : ''}` : 'SOLO';
        root.querySelector('.rescue-intro').textContent = line.linked ? 'Keep loot → send help → save a climber.' : 'Connect a second channel in Setup to trade rescues. Solo climbs still work.';
        root.querySelector('.rescue-routes').innerHTML = line.linked ? ['a', 'b'].map(team => {
            const to = other(team), rope = line.ropes[to], wait = Math.max(0, Math.ceil(((line.readyAt[team] ?? 0) - now) / 1000));
            const state = rope ? now < rope.arrivesAt ? 'Rope on the way' : `Rope ready${rope.bonusOre ? ' · +5 ore' : ''}` : wait ? `Recharging · ${wait}s` : 'Choose Keep to send';
            return `<div class="rescue-route"><span>${escape(campName(s, team))} <b>→</b> ${escape(campName(s, to))}</span><strong>${escape(state)}</strong>${rope ? `<small>From ${escape(rope.donor.name)}</small>` : ''}</div>`;
        }).join('') : '';
        const last = line.recent.at(-1);
        root.querySelector('.rescue-news').textContent = last ? `${last.rope.donor.name} (${last.rope.donor.camp}) saved ${last.recipient.name} (${last.recipient.camp}) · ${last.ore} ore kept.` : '';
    };
}
export function createRescueEffects(root) {
    const supply = document.createElement('div'); supply.className = 'rescue-supplies';
    const moment = document.createElement('div'); moment.className = 'rescue-moment'; moment.hidden = true;
    root.append(supply, moment);
    return (s, now) => {
        const ropes = s.rescue.linked ? Object.values(s.rescue.ropes) : [];
        for (const node of [...supply.children]) if (!ropes.some(r => r.id === node.dataset.id)) node.remove();
        for (const rope of ropes) {
            let node = [...supply.children].find(n => n.dataset.id === rope.id);
            if (!node) {
                node = document.createElement('div'); node.dataset.id = rope.id; node.className = 'supply-route';
                node.innerHTML = '<span class="supply-label"></span><div class="supply-track"><i class="supply-cart" aria-hidden="true">▣</i></div>';
                supply.append(node);
            }
            const arrived = now >= rope.arrivesAt;
            node.classList.toggle('arrived', arrived);
            node.classList.toggle('hype-supply', rope.bonusOre > 0);
            node.querySelector('.supply-label').textContent = `${rope.donor.name} → ${campName(s, rope.to)} · ${arrived ? 'rope ready' : 'sending rope'}${rope.bonusOre ? ' +5 ore' : ''}`;
            const progress = Math.min(1, Math.max(0, (now - rope.sentAt) / (rope.arrivesAt - rope.sentAt)));
            node.querySelector('.supply-cart').style.left = `${(rope.to === 'b' ? progress : 1 - progress) * 90}%`;
        }
        const saved = s.rescue.recent.filter(r => now - r.at < s.rescue.rules.momentMs).at(-1);
        moment.hidden = !saved;
        root.classList.toggle('show-rescue', Boolean(saved));
        if (saved) {
            const lantern = s.rescue.keepsake && now - s.rescue.keepsake.earnedAt < s.rescue.rules.momentMs;
            moment.innerHTML = `<small>${lantern ? 'BOTH CAMPS HELPED · LANTERN EARNED' : 'RESCUED'}</small><strong>${escape(saved.rope.donor.name)} saved ${escape(saved.recipient.name)}</strong><span>${escape(saved.rope.donor.camp)} → ${escape(saved.recipient.camp)} · ${saved.ore} ore kept</span>`;
        }
    };
}
