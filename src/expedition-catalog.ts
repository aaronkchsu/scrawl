export const ITEMS = [
    { id: 'shield', name: 'Pebble shield', icon: '◈', effect: 'Blocks the first hit of each climb.', color: '#b6cde4' },
    { id: 'boots', name: 'Spring boots', icon: '↟', effect: 'Skips damage from gaps.', color: '#bcf28d' },
    { id: 'lamp', name: 'Glow lantern', icon: '✦', effect: 'Finds 2 extra ore in every room.', color: '#ffe18a' },
    { id: 'crown', name: 'Crystal crown', icon: '♛', effect: 'A trophy from the summit. Wear it to show it off.', color: '#d0a9ff' },
] as const;
export type ItemId = typeof ITEMS[number]['id'];
export const isItem = (value: unknown): value is ItemId => ITEMS.some(item => item.id === value);
export const levelOf = (xp: number) => 1 + Math.floor(xp / 100);
export const DEFAULT_SETTINGS = { slots: 3, cooldownSeconds: 30, roomSeconds: 4, side: 'right' as 'left' | 'right', avatarSize: 44, autoDigOnJoin: false, giftRocks: false };
export type ExpeditionSettings = typeof DEFAULT_SETTINGS;
export function validateSettings(input: Record<string, unknown>, current = DEFAULT_SETTINGS): ExpeditionSettings {
    const next = { ...current };
    for (const [key, min, max] of [['slots', 1, 3], ['cooldownSeconds', 0, 600], ['roomSeconds', 2, 10], ['avatarSize', 28, 64]] as const) {
        if (input[key] !== undefined) {
            const n = input[key];
            if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max)
                throw new Error(`${key} must be a whole number from ${min} to ${max}.`);
            next[key] = n;
        }
    }
    if (input.side !== undefined) {
        if (!['left', 'right'].includes(input.side as string))
            throw new Error('Choose left or right.');
        next.side = input.side as 'left' | 'right';
    }
    if (input.autoDigOnJoin !== undefined) {
        if (typeof input.autoDigOnJoin !== 'boolean')
            throw new Error('Choose whether new viewers climb automatically.');
        next.autoDigOnJoin = input.autoDigOnJoin;
    }
    if (input.giftRocks !== undefined) {
        if (typeof input.giftRocks !== 'boolean')
            throw new Error('Choose whether gift subs can drop rocks.');
        next.giftRocks = input.giftRocks;
    }
    return next;
}
