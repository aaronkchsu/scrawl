import { randomUUID } from 'node:crypto';
import { demoCreation, emptyCreation } from './collective.ts';
import { fixtureRounds } from './fixtures.ts';
import { SAMPLE_SIZE, approachesFor, finalistsFrom, winningFinalist } from './selection.ts';
import { TEAM_IDS } from './types.ts';
import type { ChatMessage, Creator, Experience, MatchState, Mode, RehearsalIdea, Team, TeamId } from './types.ts';

const durations = { building: 35_000, voting: 12_000, reveal: 6_000, resolving: 8_000, finishing: 5_000 };
export class Game {
  state: MatchState;
  onChange: () => void = () => {};
  private sequence = 0;
  private seen = new Set<string>();
  private nominations = { a: new Set<string>(), b: new Set<string>() };
  private phrases = { a: new Set<string>(), b: new Set<string>() };
  private votes = { a: new Map<string, string>(), b: new Map<string, string>() };
  private generation: AbortController | null = null;
  private fixtureIndex = 0;
  private fixtureAt = 0;
  private clock: () => number;
  private random: () => number;
  private creator: Creator;

  constructor(options: { now?: () => number; random?: () => number; creator?: Creator } = {}) {
    this.clock = options.now ?? Date.now; this.random = options.random ?? Math.random;
    this.creator = options.creator ?? (async ({ messages, previous }) => demoCreation(messages, previous));
    this.state = this.initial();
  }
  private initial(): MatchState {
    const team = (id: TeamId, name: string, color: string): Team => ({ id, name, color, health: 100, score: 0, messages: [], nominationCount: 0, finalists: [], selectedId: null, voterCount: 0, creation: emptyCreation(), braces: [], result: '', lastDamage: 0, channel: null, connection: 'offline', connectionNote: 'Connect a Twitch channel when you’re ready.' });
    return { id: randomUUID(), revision: 0, mode: 'demo', experience: 'demo', phase: 'lobby', round: 0, maxRounds: 2, approaches: approachesFor(1), finisher: null, deadline: null, remainingMs: 0, paused: false, error: null, winner: null, boss: { name: 'The Inkling', health: 130, maxHealth: 130, cue: 'An ink spill with a very bad attitude.', weakness: 'absorb' }, teams: { a: team('a', 'The Doodle Ducks', '#ee7544'), b: team('b', 'The Scribble Society', '#4668d9') }, log: [], startedAt: null, autoDemo: false };
  }
  snapshot(): MatchState { return structuredClone(this.state); }
  private change() { this.state.revision++; this.onChange(); }
  private log(text: string) { this.state.log = [...this.state.log, { id: ++this.sequence, text, at: this.clock() }].slice(-12); }
  private setPhase(phase: MatchState['phase'], ms = 0) { if (this.state.experience === 'rehearsal' && ['building', 'voting', 'reveal'].includes(phase)) ms = 0; this.state.phase = phase; this.state.deadline = ms ? this.clock() + ms : null; this.state.remainingMs = ms; }
  reset() {
    this.generation?.abort(); const teams = this.state.teams; this.state = this.initial();
    for (const id of TEAM_IDS) Object.assign(this.state.teams[id], { name: teams[id].name, channel: teams[id].channel, connection: teams[id].connection, connectionNote: teams[id].connectionNote });
    this.seen.clear(); this.clearRound(); this.change();
  }
  private clearRound() {
    for (const id of TEAM_IDS) { this.nominations[id].clear(); this.phrases[id].clear(); this.votes[id].clear(); }
  }
  start(mode: Mode = 'demo', autoDemo = false, experience: Experience = autoDemo ? 'demo' : 'live') {
    if (this.state.phase !== 'lobby' && this.state.phase !== 'finished') throw new Error('Reset the current encounter before starting another.');
    this.reset(); this.state.mode = mode; this.state.experience = experience; this.state.autoDemo = autoDemo; this.state.startedAt = this.clock(); this.state.round = 1; this.beginRound();
  }
  private beginRound() {
    this.state.paused = false; this.state.error = null; this.clearRound(); this.fixtureIndex = 0; this.fixtureAt = this.clock() + 500;
    for (const team of Object.values(this.state.teams)) { team.messages = []; team.nominationCount = 0; team.finalists = []; team.selectedId = null; team.voterCount = 0; team.braces = []; team.result = ''; team.lastDamage = 0; }
    const storm = this.state.round === 2; this.state.approaches = approachesFor(this.state.round); this.state.boss.weakness = storm ? 'ground' : 'absorb';
    this.state.boss.cue = storm ? 'A stolen storm cloud. Ground, reflect, or shelter.' : 'An ink spill. Soak, catch, or shelter.';
    this.log(storm ? 'The Inkling stole a storm cloud. Adapt your inventions!' : 'One monster. Two communities. Each gets one invention per round.');
    this.setPhase('building', this.state.autoDemo ? 11_000 : durations.building); this.change();
  }
  setConnection(id: TeamId, channel: string | null, status: Team['connection'], note: string) { Object.assign(this.state.teams[id], { channel, connection: status, connectionNote: note }); if (channel) this.state.teams[id].name = channel; this.change(); }
  rename(id: TeamId, name: string) { if (this.state.phase !== 'lobby' && this.state.phase !== 'finished') throw new Error('Team names can be changed between encounters.'); this.state.teams[id].name = name.slice(0, 36).trim() || (id === 'a' ? 'The Doodle Ducks' : 'The Scribble Society'); this.change(); }
  ingest(input: Omit<ChatMessage, 'at'>): { accepted: boolean; reason?: string } {
    if ((this.state.experience === 'rehearsal' && input.source !== 'rehearsal') || (this.state.experience === 'demo' && input.source !== 'demo') || (this.state.experience === 'live' && ['demo', 'rehearsal'].includes(input.source))) return { accepted: false, reason: 'This input belongs to a different experience.' };
    if (this.state.paused || !['building', 'voting', 'generating', 'reveal'].includes(this.state.phase)) return { accepted: false, reason: 'The invention window is closed.' };
    if (this.seen.has(input.id)) return { accepted: false, reason: 'Duplicate event.' };
    const text = input.text.trim().slice(0, 280); if (!text) return { accepted: false, reason: 'Empty message.' };
    this.seen.add(input.id); if (this.seen.size > 10_000) this.seen.delete(this.seen.values().next().value!);
    const team = this.state.teams[input.team];
    if (/^!brace\s*$/i.test(text)) {
      if (!this.nominations[input.team].has(input.userId)) return { accepted: false, reason: 'Nominate first to contribute a brace this round.' };
      if (team.braces.includes(input.userId)) return { accepted: false, reason: 'Your brace is already counted.' };
      team.braces.push(input.userId); this.change(); return { accepted: true };
    }
    if (/^!vote\b/i.test(text)) {
      if (this.state.phase !== 'voting') return { accepted: false, reason: 'Voting opens after nominations close.' };
      const id = /^!vote\s+([123])\s*$/i.exec(text)?.[1]; const finalist = team.finalists.find(f => f.id === id);
      if (!finalist) return { accepted: false, reason: 'Vote for an available finalist: !vote 1, !vote 2, or !vote 3.' };
      const previous = this.votes[input.team].get(input.userId);
      if (previous === id) return { accepted: false, reason: 'Your vote is already counted.' };
      const old = team.finalists.find(f => f.id === previous); if (old) old.votes--;
      this.votes[input.team].set(input.userId, id!); finalist.votes++; team.voterCount = this.votes[input.team].size; this.change(); return { accepted: true };
    }
    if (this.state.phase !== 'building') return { accepted: false, reason: 'Nominations closed. Vote or type !brace.' };
    if (this.nominations[input.team].has(input.userId)) return { accepted: false, reason: 'One nomination per viewer per round. Vote when finalists appear.' };
    const command = /^!idea\s+(\w+)\s+(.+)$/i.exec(text);
    if (input.source === 'twitch' && !command) return { accepted: false, reason: 'Use !idea counter your invention. Ordinary chat is not a nomination.' };
    if (text.startsWith('!') && !command) return { accepted: false, reason: 'Use !idea counter your invention.' };
    const approachId = command?.[1].toLowerCase() ?? input.approach ?? this.state.approaches[0].id;
    if (!this.state.approaches.some(a => a.id === approachId)) return { accepted: false, reason: `Choose a counter: ${this.state.approaches.map(a => a.id).join(', ')}.` };
    const suggestion = (command?.[2] ?? text).trim();
    const normalized = suggestion.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!normalized) return { accepted: false, reason: 'Add an invention to your nomination.' };
    if (this.phrases[input.team].has(normalized)) return { accepted: false, reason: 'That idea is already nominated. Add something different, then vote.' };
    this.nominations[input.team].add(input.userId); this.phrases[input.team].add(normalized); team.nominationCount++;
    const message = { ...input, name: input.name.slice(0, 30), text: suggestion, approach: approachId, at: this.clock() };
    // Uniform reservoir over distinct authors, rather than earliest or loudest messages.
    if (team.messages.length < SAMPLE_SIZE) team.messages.push(message);
    else { const index = Math.floor(this.random() * team.nominationCount); if (index < SAMPLE_SIZE) team.messages[index] = message; }
    this.change(); return { accepted: true };
  }
  openVote() {
    if (this.state.phase !== 'building') throw new Error('Nominations are not open.');
    if (this.state.paused) throw new Error('Resume before closing nominations.');
    for (const team of Object.values(this.state.teams)) team.finalists = finalistsFrom(team.messages, this.state.approaches, this.random);
    this.log('Up to three sampled finalists per community. Vote for the lead; the others add visual details. Ties are drawn at random.');
    this.setPhase('voting', this.state.autoDemo ? 6_000 : durations.voting); this.change();
  }
  async lock() {
    const retry = this.state.phase === 'generating' && Boolean(this.state.error);
    if (this.state.phase !== 'voting' && !retry) throw new Error('Close nominations and vote before drawing.');
    if (this.state.paused && !retry) throw new Error('Resume before closing the vote.');
    if (!retry) for (const team of Object.values(this.state.teams)) { team.selectedId = winningFinalist(team.finalists, this.random)?.id ?? null; }
    this.generation?.abort(); const controller = new AbortController(); this.generation = controller;
    const matchId = this.state.id; const round = this.state.round;
    this.state.paused = false; this.state.error = null; this.setPhase('generating'); this.change();
    try {
      const creations = await Promise.all(TEAM_IDS.map(async id => {
        const team = this.state.teams[id]; const lead = team.finalists.find(f => f.id === team.selectedId);
        if (!lead) return { ...emptyCreation(), name: 'A blank page', description: 'No nomination this round. The monster is unimpressed.' };
        const messages = [lead.message, ...team.finalists.filter(f => f.id !== lead.id).map(f => f.message)];
        if (this.state.mode === 'ai') return this.creator({ team: id, messages: structuredClone(messages), previous: structuredClone(team.creation), weakness: this.state.boss.weakness, selection: { messageId: lead.message.id, approach: structuredClone(lead.approach) }, signal: controller.signal });
        const creation = demoCreation(messages, team.creation); creation.body = demoCreation([lead.message], team.creation).body; creation.name = demoCreation([lead.message], team.creation).name; creation.capabilities = [lead.approach.capability];
        if (!creation.features.includes(lead.approach.tool)) creation.features = [lead.approach.tool, ...creation.features].slice(0, 4);
        creation.contributions = messages.map(m => {
          const details = demoCreation([m]).features.filter(f => creation.features.includes(f));
          return { messageId: m.id, name: m.name, feature: m.id === lead.message.id ? `Lead: ${creation.body} · ${lead.approach.label}` : details.length ? `Visual detail: ${details.join(' + ')}` : 'Finalist inspiration · limited demo vocabulary' };
        });
        return creation;
      }));
      if (controller.signal.aborted || this.state.id !== matchId || this.state.round !== round) return;
      TEAM_IDS.forEach((id, i) => { this.state.teams[id].creation = creations[i]; });
      this.log('One invention each. Different audience sizes, the same upgrade budget.'); this.setPhase('reveal', this.state.autoDemo ? 4_000 : durations.reveal); this.change();
    } catch (error) {
      if (controller.signal.aborted || this.state.id !== matchId) return;
      controller.abort(); this.state.error = error instanceof Error ? error.message : 'Generation failed.'; this.state.paused = true; this.state.deadline = null;
      this.log('The selected recipes stay visible. Both teams wait; the host can retry or reset.'); this.change();
    }
  }
  playRehearsalFight() {
    if (this.state.experience !== 'rehearsal' || this.state.phase !== 'reveal') throw new Error('Inspect both drawings before playing the fight.');
    this.resolve();
  }
  submitRehearsal(ideas: Record<TeamId, RehearsalIdea[]>) {
    if (this.state.experience !== 'rehearsal' || this.state.phase !== 'building') throw new Error('Open a rehearsal idea editor first.');
    for (const team of TEAM_IDS) for (const [index, idea] of ideas[team].entries()) {
      const result = this.ingest({ ...idea, team, source: 'rehearsal', id: randomUUID(), userId: `rehearsal-${team}-${index}` });
      if (!result.accepted) throw new Error(result.reason);
    }
    this.openVote();
  }
  voteRehearsal(team: TeamId, finalist: string) {
    if (this.state.experience !== 'rehearsal') throw new Error('Open a rehearsal first.');
    return this.ingest({ team, text: `!vote ${finalist}`, source: 'rehearsal', name: 'Sample voter', id: randomUUID(), userId: `rehearsal-voter-${team}` });
  }
  pause() {
    if (this.state.experience === 'rehearsal' && ['building', 'voting', 'reveal'].includes(this.state.phase)) throw new Error('This rehearsal step already waits for you.');
    if (!['building', 'voting', 'reveal', 'resolving', 'finishing'].includes(this.state.phase)) throw new Error('This phase cannot be paused.');
    this.state.paused = !this.state.paused;
    if (this.state.paused) { this.state.remainingMs = Math.max(0, (this.state.deadline ?? this.clock()) - this.clock()); this.state.deadline = null; }
    else this.state.deadline = this.clock() + this.state.remainingMs;
    this.fixtureAt = this.clock() + 500; this.change();
  }
  private resolve() {
    const selected = TEAM_IDS.map(id => this.state.teams[id].finalists.find(f => f.id === this.state.teams[id].selectedId)?.approach);
    const comboPair = this.state.round === 1 ? ['absorb', 'contain'] : ['ground', 'reflect'];
    const combo = comboPair.every(cap => selected.some(a => a?.capability === cap)); let total = 0;
    for (const [index, id] of TEAM_IDS.entries()) {
      const team = this.state.teams[id]; const approach = selected[index]; const damage = approach ? approach.impact + (combo ? 6 : 0) : 0;
      // Only actual nominees can contribute to the brace ratio. Extra non-nominee accounts cannot inflate it.
      const braced = team.braces.filter(user => this.nominations[id].has(user)).length;
      const braceRatio = team.nominationCount ? braced / team.nominationCount : 0;
      const incoming = Math.max(0, 24 - (approach?.defense ?? 0) - Math.round(braceRatio * 12));
      team.health = Math.max(0, team.health - incoming); team.score += damage; team.lastDamage = damage; total += damage;
      team.result = approach ? `${approach.label}: ${damage} impact${combo ? ' (+6 community combo)' : ''} · ${incoming} damage taken. Votes choose the idea; they never multiply power.` : 'No nomination. The blank page takes the hit.';
    }
    this.state.boss.health = Math.max(0, this.state.boss.health - total);
    if (combo) this.log(this.state.round === 1 ? 'Community combo! One invention soaks while the other catches. +6 impact each.' : 'Community combo! One invention reflects into the other’s grounding path. +6 impact each.');
    this.log(`${total} combined impact. ${this.state.boss.health ? 'The Inkling is reconsidering its choices.' : 'Both communities out-doodled the monster!'}`);
    this.setPhase('resolving', durations.resolving); this.change();
  }
  private endRound() {
    if (this.state.boss.health === 0) {
      const components = TEAM_IDS.flatMap(id => { const team = this.state.teams[id]; const selected = team.finalists.find(f => f.id === team.selectedId); return selected ? [{ team: id, name: team.creation.name, lead: selected.message.text }] : []; });
      if (components.length === 2) { this.state.finisher = { name: 'THE COLLECTIVE FINISHER', components }; this.log('Two inventions. One finishing move. Both communities own this victory.'); this.setPhase('finishing', durations.finishing); this.change(); }
      else this.finish();
    } else if (this.state.round >= this.state.maxRounds) this.finish();
    else { this.state.round++; this.beginRound(); }
  }
  private finish() {
    this.state.winner = this.state.boss.health > 0 ? 'boss' : 'tie';
    this.log(this.state.winner === 'boss' ? 'The Inkling survives. Both communities can try again.' : 'Shared victory. Two communities, one wonderfully bad idea.'); this.setPhase('finished'); this.change();
  }
  tick() {
    if (this.state.paused) return; const now = this.clock();
    if (this.state.autoDemo && now >= this.fixtureAt) {
      if (this.state.phase === 'building') { const row = fixtureRounds[this.state.round - 1]?.[this.fixtureIndex]; if (row) { this.ingest({ ...row, id: `${this.state.id}-${this.state.round}-${this.fixtureIndex}`, userId: `demo-${row.name}`, source: 'demo' }); } }
      else if (this.state.phase === 'voting') for (const id of TEAM_IDS) { const team = this.state.teams[id]; const primary = this.state.round === 1 ? (id === 'a' ? 'soak' : 'catch') : (id === 'a' ? 'ground' : 'reflect'); const candidate = team.finalists.find(f => f.approach.id === primary) ?? team.finalists[0]; if (candidate) this.ingest({ id: randomUUID(), userId: `demo-voter-${this.fixtureIndex}`, name: 'demo-voter', team: id, text: `!vote ${candidate.id}`, source: 'demo' }); };
      this.fixtureIndex++; this.fixtureAt = now + 800;
    }
    if (this.state.deadline !== null && now >= this.state.deadline) {
      if (this.state.phase === 'building') this.openVote();
      else if (this.state.phase === 'voting') void this.lock();
      else if (this.state.phase === 'reveal') this.resolve();
      else if (this.state.phase === 'resolving') this.endRound();
      else if (this.state.phase === 'finishing') this.finish();
    }
  }
  close() { this.generation?.abort(); }
}
