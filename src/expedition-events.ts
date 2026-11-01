import type { TeamId } from './types.ts';

export const ROCK_RULES = { warningMs: 8000, cooldownMs: 30000, hitChance: .35, damage: 1, resultMs: 6000 } as const;
export type GiftEvent = { id: string; team: TeamId; name: string; total: number; at: number };
export type GiftRock = GiftEvent & {
    runId: string;
    playerName: string;
    lane: number;
    floor: number;
    impactAt: number;
    endsAt: number;
    status: 'warning' | 'missed' | 'blocked' | 'hit' | 'lost' | 'rescued' | 'cancelled';
    message: string;
};
