// Four original sprites share one transparent atlas. Identity is stable across
// the profile, camp, and overlay without changing saved player records.
const EXPLORERS = [
    { name: 'Square stone explorer', viewBox: '136 120 500 596' },
    { name: 'Tall pebble explorer', viewBox: '750 48 348 664' },
    { name: 'Wide stone explorer', viewBox: '132 824 526 409' },
    { name: 'Crystal explorer', viewBox: '718 714 405 522' },
];
const GEAR = { shield: '◈', boots: '↟', lamp: '✦', crown: '♛' };

export function explorerFor(player) {
    let hash = 2166136261;
    for (const char of String(player.id || player.name || 'explorer')) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    }
    return EXPLORERS[hash % EXPLORERS.length];
}

export function avatar(player) {
    const explorer = explorerFor(player);
    const gear = Object.hasOwn(GEAR, player.equipped) ? player.equipped : null;
    const [x, y, width, height] = explorer.viewBox.split(' ');
    // The inner viewport clips the atlas before the outer viewport fits it.
    // Otherwise neighboring sprites can appear in the letterboxed space.
    return `<span class="avatar" aria-hidden="true"><svg class="explorer-sprite" viewBox="${explorer.viewBox}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${explorer.viewBox}" overflow="hidden"><image href="/assets/explorers-mono.png" width="1254" height="1254"/></svg></svg>${player.keepsakes?.length ? '<i class="keepsake-pin">♧</i>' : ''}${gear ? `<i class="equipped ${gear}">${GEAR[gear]}</i>` : ''}</span>`;
}
