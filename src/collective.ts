import type { Capability, ChatMessage, Creation } from './types.ts';

export function emptyCreation(): Creation {
  return { name: 'A very good idea, probably', description: 'Your community holds the pencil.', body: 'blank', features: [], capabilities: [], contributions: [], shapes: [], origin: 'demo', generationMs: 0 };
}

// Bound influence by author, not message volume. Keep their most recent two DISTINCT ideas.
export function balanceMessages(messages: ChatMessage[]): ChatMessage[] {
  const users = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const ideas = users.get(message.userId) ?? [];
    const normalized = message.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (ideas.some(m => m.text.toLowerCase().replace(/\s+/g, ' ').trim() === normalized)) continue;
    ideas.push(message);
    users.set(message.userId, ideas.slice(-2));
  }
  // Two-pass interleave keeps an active author from filling the context budget.
  return [0, 1].flatMap(i => [...users.values()].map(v => v[i]).filter((v): v is ChatMessage => Boolean(v))).slice(0, 120);
}

const motifs = [
  { id: 'duck', re: /\b(duck|goose|bird)\b/i },
  { id: 'robot', re: /\b(robot|tank|machine|vacuum)\b/i },
  { id: 'cat', re: /\b(cat|kitten|kitty)\b/i },
  { id: 'frog', re: /\b(frog|toad)\b/i },
];
const features: { id: string; label: string; re: RegExp; capability: Capability }[] = [
  { id: 'sponge', label: 'sponge', re: /\b(sponge|absorb|soak|towel)\b/i, capability: 'absorb' },
  { id: 'bucket', label: 'bucket', re: /\b(bucket|jar|bottle|contain|cup)\b/i, capability: 'contain' },
  { id: 'wire', label: 'grounding wire', re: /\b(wire|ground|copper|cable)\w*/i, capability: 'ground' },
  { id: 'boots', label: 'rubber boots', re: /\b(boots?|rubber|insulat)\w*/i, capability: 'shield' },
  { id: 'umbrella', label: 'umbrella', re: /\b(umbrella|shield|protect|shelter)\w*/i, capability: 'shield' },
  { id: 'mirror', label: 'mirror', re: /\b(mirror|reflect|disco)\w*/i, capability: 'reflect' },
  { id: 'wheels', label: 'wheels', re: /\b(wheels?|skates?|roller|fast)\b/i, capability: 'move' },
  { id: 'magnet', label: 'magnet', re: /\b(magnet|anchor|heavy|weight)\w*/i, capability: 'anchor' },
  { id: 'party', label: 'party hat', re: /\b(party|dance|music|distract|hat)\w*/i, capability: 'distract' },
];

// Deliberately deterministic demo adapter. Live AI uses its own structured drawing output.
export function demoCreation(messages: ChatMessage[], previous = emptyCreation()): Creation {
  const balanced = balanceMessages(messages);
  const bodyVotes = motifs.map(m => ({ ...m, authors: new Set(balanced.filter(v => m.re.test(v.text)).map(v => v.userId)) }));
  bodyVotes.sort((a, b) => b.authors.size - a.authors.size);
  const body = bodyVotes[0]?.authors.size ? bodyVotes[0].id : previous.body === 'blank' ? 'robot' : previous.body;
  const bodyMessage = balanced.find(m => motifs.find(b => b.id === body)?.re.test(m.text));
  const chosen = features.flatMap(f => {
    const matches = balanced.filter(m => f.re.test(m.text));
    return matches.length ? [{ ...f, matches, count: new Set(matches.map(m => m.userId)).size }] : [];
  }).sort((a, b) => b.count - a.count).slice(0, 3);
  const credited = new Set<string>();
  const contributions = chosen.map(f => {
    const message = f.matches.find(m => !credited.has(m.userId)) ?? f.matches[0];
    credited.add(message.userId);
    return { messageId: message.id, name: message.name, feature: f.label };
  });
  if (bodyMessage && !credited.has(bodyMessage.userId)) contributions.unshift({ messageId: bodyMessage.id, name: bodyMessage.name, feature: body });
  const names: Record<string, string> = { duck: 'Professor Quack', robot: 'The Questionable Appliance', cat: 'Captain Absolutely Not', frog: 'Sir Hops-a-Lot' };
  return {
    name: names[body], body, features: chosen.map(f => f.id), capabilities: chosen.map(f => f.capability),
    description: chosen.length ? `${body[0].toUpperCase() + body.slice(1)} + ${chosen.map(f => f.label).join(' + ')}. Chat made this.` : 'A beginning. Give it something ridiculous to work with.',
    contributions: contributions.slice(0, 4), shapes: [], origin: 'demo', generationMs: 0,
  };
}
