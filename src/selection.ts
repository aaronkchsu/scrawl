import type { Approach, ChatMessage, Finalist } from './types.ts';

export const SAMPLE_SIZE = 12;
export function approachesFor(round: number): Approach[] {
  return round === 2 ? [
    { id: 'ground', label: 'Ground it', capability: 'ground', tool: 'wire', impact: 35, defense: 0, description: 'A conductive wire to earth. 35 impact.' },
    { id: 'reflect', label: 'Reflect it', capability: 'reflect', tool: 'mirror', impact: 35, defense: 0, description: 'A reflective surface. 35 impact.' },
    { id: 'shield', label: 'Shelter', capability: 'shield', tool: 'umbrella', impact: 18, defense: 12, description: 'An insulating barrier. 18 impact; blocks 12 damage.' },
  ] : [
    { id: 'soak', label: 'Soak it up', capability: 'absorb', tool: 'sponge', impact: 35, defense: 0, description: 'An absorbent invention. 35 impact.' },
    { id: 'catch', label: 'Catch it', capability: 'contain', tool: 'bucket', impact: 35, defense: 0, description: 'Something that holds ink. 35 impact.' },
    { id: 'shield', label: 'Shelter', capability: 'shield', tool: 'umbrella', impact: 18, defense: 12, description: 'A protective barrier. 18 impact; blocks 12 damage.' },
  ];
}
export function finalistsFrom(messages: ChatMessage[], approaches: Approach[], random: () => number): Finalist[] {
  const pool = [...messages];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3).map((message, i) => ({ id: String(i + 1), message, approach: approaches.find(a => a.id === message.approach) ?? approaches[0], votes: 0 }));
}
export function winningFinalist(finalists: Finalist[], random: () => number): Finalist | undefined {
  if (!finalists.length) return;
  const highest = Math.max(...finalists.map(f => f.votes));
  const tied = finalists.filter(f => f.votes === highest);
  return tied[Math.floor(random() * tied.length)];
}
