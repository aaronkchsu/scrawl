const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function pixelArt(rows, label = '') {
    if (!Array.isArray(rows) || rows.length !== 16 || rows.some(row => !/^[.123]{16}$/.test(row))) return '';
    const colors = { 1: '#29292d', 2: '#f2ead9', 3: '#e8b956' };
    return `<svg class="cave-sprite" viewBox="0 0 16 16" role="img" aria-label="${escape(label)}" shape-rendering="crispEdges">${rows.map((row, y) => [...row].map((cell, x) => colors[cell] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[cell]}"/>` : '').join('')).join('')}</svg>`;
}
export function findCard(find) {
    return `<details class="cave-find"><summary>${pixelArt(find.findPixels, find.findName)}<span>${escape(find.findName)}<small>From ${escape(find.fromCamp)} · cosmetic</small></span></summary><p>${escape(find.name)}</p>${find.credits.map(c => `<p><b>${escape(c.name)}</b> · ${escape(c.feature)}</p>`).join('')}</details>`;
}
