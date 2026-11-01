import { randomUUID } from 'node:crypto';
import type { TeamId } from './types.ts';

export const RESCUE_RULES = { travelMs: 3000, cooldownMs: 60000, momentMs: 12000, hypeOre: 5 };
export const otherCamp = (team: TeamId): TeamId => team === 'a' ? 'b' : 'a';
export type RescuePerson = { id: string; name: string; team: TeamId; camp: string };
export type Rope = { id: string; donor: RescuePerson; to: TeamId; sentAt: number; arrivesAt: number; bonusOre: number };
export type Rescue = { id: string; rope: Rope; recipient: RescuePerson; at: number; ore: number; lane: number; floor: number };
export type Keepsake = { id: string; camps: [string, string]; people: RescuePerson[]; earnedAt: number };

// Each direction has the same capacity and recharge, independent of chat size.
export class RescueLine {
    ropes: Partial<Record<TeamId, Rope>> = {};
    readyAt: Partial<Record<TeamId, number>> = {};
    helped: Partial<Record<TeamId, Rescue>> = {};
    recent: Rescue[] = [];
    keepsake: Keepsake | null = null;
    reset() { this.ropes = {}; this.readyAt = {}; this.helped = {}; this.recent = []; this.keepsake = null; }
    send(donor: RescuePerson, now: number, hyped: boolean): Rope | null {
        const to = otherCamp(donor.team);
        if (this.ropes[to] || now < (this.readyAt[donor.team] ?? 0)) return null;
        const rope: Rope = { id: randomUUID(), donor: { ...donor }, to, sentAt: now, arrivesAt: now + RESCUE_RULES.travelMs, bonusOre: hyped ? RESCUE_RULES.hypeOre : 0 };
        this.ropes[to] = rope;
        this.readyAt[donor.team] = now + RESCUE_RULES.cooldownMs;
        return rope;
    }
    catch(recipient: RescuePerson, now: number, ore: number, lane: number, floor: number): Rescue | null {
        const rope = this.ropes[recipient.team];
        if (!rope || now < rope.arrivesAt || rope.donor.id === recipient.id) return null;
        delete this.ropes[recipient.team];
        const rescue = { id: randomUUID(), rope, recipient: { ...recipient }, at: now, ore: ore + rope.bonusOre, lane, floor };
        this.helped[rope.donor.team] = rescue;
        this.recent = [...this.recent.filter(r => now - r.at < RESCUE_RULES.momentMs), rescue].slice(-4);
        return rescue;
    }
    award(pair: string, camps: [string, string], now: number): Keepsake | null {
        if (this.keepsake || !this.helped.a || !this.helped.b) return null;
        const people = [this.helped.a.rope.donor, this.helped.a.recipient, this.helped.b.rope.donor, this.helped.b.recipient];
        this.keepsake = { id: pair, camps, people: [...new Map(people.map(p => [p.id, p])).values()], earnedAt: now };
        return this.keepsake;
    }
}

export function validKeepsakes(value: unknown): value is Keepsake[] {
    if (!Array.isArray(value) || value.length > 20) return false;
    const text = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;
    return value.every(k => k && text(k.id, 160) && Array.isArray(k.camps) && k.camps.length === 2 && k.camps.every((c: unknown) => text(c, 50)) && Number.isSafeInteger(k.earnedAt) && k.earnedAt >= 0 && Array.isArray(k.people) && k.people.length >= 2 && k.people.length <= 4 && k.people.every((p: RescuePerson) => p && /^(demo|twitch):[a-zA-Z0-9_-]{1,50}$/.test(p.id) && text(p.name, 25) && text(p.camp, 50) && ['a', 'b'].includes(p.team)));
}
