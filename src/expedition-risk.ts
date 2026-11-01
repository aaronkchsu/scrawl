import type { Run } from './expedition.ts';

// Enumerate damage branches, including the shield's one-use state. These are
// route odds, conditional on the current gear/HP; future Twitch events are excluded.
export function routeOutlook(run: Run) {
    function survive(floor: number, hp: number, shieldUsed: boolean): number {
        if (hp <= 0) return 0;
        const room = run.rooms[floor];
        if (!room) return 1;
        const chance = room.kind === 'gap' && run.equipped === 'boots' ? 0 : room.chance;
        const blocked = run.equipped === 'shield' && !shieldUsed;
        return (1 - chance) * survive(floor + 1, hp, shieldUsed)
            + chance * survive(floor + 1, hp - (blocked ? 0 : room.damage), shieldUsed || blocked);
    }
    return {
        survivalChance: survive(run.floor, run.hp, run.shieldUsed),
        summitOre: run.loot + run.rooms.slice(run.floor).reduce((sum, room) => sum + (room.ore + (run.equipped === 'lamp' ? 2 : 0)) * run.multiplier, 0),
    };
}
