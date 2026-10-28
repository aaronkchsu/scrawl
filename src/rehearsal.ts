import { TEAM_IDS } from './types.ts';
import type { Approach, RehearsalIdea, TeamId } from './types.ts';

// Validate the whole editor before admitting any nomination to the game.
export function rehearsalIdeas(value: unknown, approaches: Approach[]): Record<TeamId, RehearsalIdea[]> {
  if (!value || typeof value !== 'object') throw new Error('Prepare ideas for both communities.');
  const result = {} as Record<TeamId, RehearsalIdea[]>;
  for (const team of TEAM_IDS) {
    const rows = (value as Record<string, unknown>)[team];
    const label = team === 'a' ? 'Orange' : 'Blue';
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 3) throw new Error(`${label} needs one to three ideas.`);
    const seen = new Set<string>();
    result[team] = rows.map((row, index) => {
      if (!row || typeof row.text !== 'string' || typeof row.approach !== 'string') throw new Error(`${label} idea ${index + 1} needs text and a counter.`);
      const text = row.text.trim();
      const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (!key || text.length > 280 || text.startsWith('!')) throw new Error(`${label} idea ${index + 1}: write an invention in 1–280 characters, without a chat command.`);
      if (seen.has(key)) throw new Error(`${label} has duplicate ideas. Give each sample viewer a different idea.`);
      seen.add(key);
      if (!approaches.some(a => a.id === row.approach)) throw new Error(`${label} idea ${index + 1}: choose a counter for this round.`);
      return { name: typeof row.name === 'string' ? row.name.trim().slice(0, 30) || `Sample ${index + 1}` : `Sample ${index + 1}`, text, approach: row.approach };
    });
  }
  return result;
}
