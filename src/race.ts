import type { ResultReason, Team, TeamId } from './types.ts';

export const BOSS_HEALTH = 70;
type Outcome = { winner: TeamId | 'tie'; reason: ResultReason };

// Call only after both teams' attacks have resolved for the round.
export function raceOutcome(teams: Record<TeamId, Team>, round: number, maxRounds: number): Outcome | null {
  const a = teams.a.boss.health, b = teams.b.boss.health;
  if (a === 0 && b === 0) return { winner: 'tie', reason: 'same-round' };
  if (a === 0 || b === 0) return { winner: a === 0 ? 'a' : 'b', reason: 'boss-defeated' };
  if (round < maxRounds) return null;
  return { winner: a === b ? 'tie' : a < b ? 'a' : 'b', reason: 'round-limit' };
}
