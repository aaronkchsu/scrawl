export type TeamId = 'a' | 'b';
export const TEAM_IDS: TeamId[] = ['a', 'b'];
export const CAPABILITIES = ['absorb', 'contain', 'ground', 'reflect', 'shield', 'anchor', 'distract', 'move'] as const;
export type Capability = typeof CAPABILITIES[number];
export type Mode = 'demo' | 'ai';
export type Experience = 'demo' | 'rehearsal' | 'live';
export interface RehearsalIdea { name: string; text: string; approach: string }
export type Phase = 'lobby' | 'building' | 'voting' | 'generating' | 'reveal' | 'resolving' | 'finishing' | 'finished';
export interface Approach { id: string; label: string; capability: Capability; tool: string; impact: number; defense: number; description: string }
export interface ChatMessage { id: string; userId: string; name: string; team: TeamId; text: string; at: number; source: 'demo' | 'rehearsal' | 'twitch' | 'manual'; approach?: string }
export interface Finalist { id: string; message: ChatMessage; approach: Approach; votes: number }
export interface Contribution { messageId: string; name: string; feature: string }
export interface Shape { kind: 'path' | 'ellipse' | 'rect' | 'line'; x: number; y: number; w: number; h: number; angle: number; path: string; fill: string; layer: 'body' | 'tool' | 'feet' }
export interface Creation { name: string; description: string; body: string; features: string[]; capabilities: Capability[]; contributions: Contribution[]; shapes: Shape[]; origin: 'demo' | 'ai'; generationMs: number }
export interface Boss { name: string; health: number; maxHealth: number; cue: string; weakness: Capability }
export type ResultReason = 'boss-defeated' | 'same-round' | 'round-limit';
export interface Team { boss: Boss; id: TeamId; name: string; color: string; health: number; score: number; messages: ChatMessage[]; nominationCount: number; finalists: Finalist[]; selectedId: string | null; voterCount: number; creation: Creation; braces: string[]; result: string; lastDamage: number; channel: string | null; connection: 'offline' | 'connecting' | 'connected' | 'error'; connectionNote: string }
export interface MatchState { id: string; revision: number; mode: Mode; experience: Experience; phase: Phase; round: number; maxRounds: number; approaches: Approach[]; resultReason: ResultReason | null; deadline: number | null; remainingMs: number; paused: boolean; error: string | null; winner: TeamId | 'tie' | null; teams: Record<TeamId, Team>; log: { id: number; text: string; at: number }[]; startedAt: number | null; autoDemo: boolean }
export interface CreatorInput { team: TeamId; messages: ChatMessage[]; previous: Creation; weakness: Capability; selection?: { messageId: string; approach: Approach }; signal: AbortSignal }
export type Creator = (input: CreatorInput) => Promise<Creation>;
