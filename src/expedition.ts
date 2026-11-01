import { CaveWorkshop, type Cave, type CaveCreator } from './expedition-caves.ts';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS, ITEMS, isItem, validateSettings, type ExpeditionSettings, type ItemId } from './expedition-catalog.ts';
import { ProfileStore, type Profile } from './expedition-store.ts';
import type { ChatMessage, Team, TeamId } from './types.ts';
import { routeOutlook } from './expedition-risk.ts';
import { ROCK_RULES, type GiftEvent, type GiftRock } from './expedition-events.ts';
import { RescueLine, RESCUE_RULES, otherCamp, type Rescue, type RescuePerson } from './expedition-rescue.ts';
export const isExpeditionCommand = (text: string) => /^!(join|dig|keep|risk|equip|idea)(?:\s|$)/i.test(text.trim());
type Player = Profile & {
    team: TeamId;
    lastSeen: number;
};
type Room = {
    kind: 'crate' | 'slime' | 'gap' | 'crystal';
    label: string;
    ore: number;
    damage: number;
    chance: number;
};
export type Run = {
    id: string;
    playerId: string;
    team: TeamId;
    lane: number;
    floor: number;
    rooms: Room[];
    phase: 'climbing' | 'choice' | 'banked' | 'lost';
    hp: number;
    loot: number;
    item: ItemId;
    equipped: ItemId | null;
    shieldUsed: boolean;
    multiplier: number;
    nextAt: number | null;
    startedAt: number;
    message: string;
    gainedXp: number;
    giftRocks: boolean;
    rockUsed: boolean;
    rescue?: Rescue;
    cave?: Cave;
};
type Queued = {
    playerId: string;
    team: TeamId;
    multiplier: number;
};
export type HypeEvent = {
    deliveryId?: string;
    id: string;
    team: TeamId;
    kind: 'begin' | 'progress' | 'end';
    level: number;
    expiresAt: number;
    startedAt: number;
};
type Hype = HypeEvent & {
    multiplier: number;
};
type Options = {
    seedDemo?: boolean;
    store?: ProfileStore;
    caveCreator?: CaveCreator;
    now?: () => number;
    random?: () => number;
};
const DEMO_NAMES = ['Noodle', 'Mossboss', 'Peach', 'Pebble', 'Luna', 'Toast', 'Sprout', 'Orbit'];
const channel = () => ({ name: '', status: 'offline' as Team['connection'], note: 'Connect a Twitch channel.', hypeAvailable: false, giftsAvailable: false });
export class Expedition {
    paused = false;
    campSettings: Partial<Record<TeamId, ExpeditionSettings>> = {};
    id = randomUUID();
    mode: 'demo' | 'live' = 'demo';
    settings: ExpeditionSettings = { ...DEFAULT_SETTINGS };
    channels = { a: channel(), b: channel() };
    players = new Map<string, Player>();
    runs: Run[] = [];
    queue: Queued[] = [];
    hype: Partial<Record<TeamId, Hype>> = {};
    rocks: GiftRock[] = [];
    rescueLine = new RescueLine();
    caves: CaveWorkshop;
    practice: { leg: number; role: 'send' | 'receive'; playerId: string; runId: string; done: boolean } | null = null;
    events: {
        id: string;
        text: string;
        at: number;
    }[] = [];
    onChange = () => { };
    private clock: () => number;
    private random: () => number;
    readonly store: ProfileStore;
    private nextStart = 0;
    private lastStartedTeam: TeamId | null = null;
    private lastDig = new Map<string, number>();
    private seen = new Set<string>();
    private endedTrains = new Set<string>();
    private seenGifts = new Set<string>();
    private lastRock: Partial<Record<TeamId, number>> = {};
    private sessionStartedAt: number;
    constructor(options: Options = {}) {
        this.caves = new CaveWorkshop(options.caveCreator);
        this.caves.onChange = () => this.changed();
        this.clock = options.now ?? Date.now;
        this.sessionStartedAt = this.clock();
        this.random = options.random ?? Math.random;
        this.store = options.store ?? new ProfileStore();
        this.settings = { ...this.store.settings };
        if (options.seedDemo !== false) this.seedDemo();
    }
    checkpoint() {
        return structuredClone({ version: 1 as const, savedAt: this.clock(), id: this.id, mode: this.mode,
            settings: this.settings, campSettings: this.campSettings, paused: this.paused, channels: this.channels,
            players: [...this.players], runs: this.runs, queue: this.queue, hype: this.hype, rocks: this.rocks,
            rescue: { ...this.rescueLine }, caves: this.caves.snapshot(), practice: this.practice, events: this.events,
            nextStart: this.nextStart, lastStartedTeam: this.lastStartedTeam, lastDig: [...this.lastDig],
            seen: [...this.seen], endedTrains: [...this.endedTrains], seenGifts: [...this.seenGifts], lastRock: this.lastRock,
            sessionStartedAt: this.sessionStartedAt });
    }
    restore(saved: ReturnType<Expedition['checkpoint']>, downtime = 0) {
        if (saved.version !== 1) throw new Error('Unsupported camp save.');
        const s = structuredClone(saved);
        const shift = (n: number | null) => n === null ? null : n + downtime;
        Object.assign(this, { id: s.id, mode: s.mode, settings: s.settings, campSettings: s.campSettings ?? {}, paused: s.paused ?? false,
            channels: s.channels, runs: s.runs, queue: s.queue, hype: s.hype, rocks: s.rocks, practice: s.practice, events: s.events,
            nextStart: shift(s.nextStart), lastStartedTeam: s.lastStartedTeam, lastRock: s.lastRock, sessionStartedAt: s.sessionStartedAt });
        this.players = new Map(s.players.map(([id, p]) => [id, { ...p, ...(this.store.profiles[id] ?? {}) }]));
        this.lastDig = new Map(s.lastDig.map(([id, at]) => [id, at + downtime]));
        this.seen = new Set(s.seen); this.endedTrains = new Set(s.endedTrains); this.seenGifts = new Set(s.seenGifts);
        Object.assign(this.rescueLine, s.rescue);
        this.caves.restore(s.caves);
        for (const r of this.runs) r.nextAt = shift(r.nextAt);
        for (const rock of this.rocks) { rock.impactAt += downtime; rock.endsAt += downtime; }
        for (const rope of Object.values(this.rescueLine.ropes)) rope.arrivesAt += downtime;
        for (const team of ['a', 'b'] as const) {
            if (this.rescueLine.readyAt[team]) this.rescueLine.readyAt[team]! += downtime;
            if (this.lastRock[team]) this.lastRock[team]! += downtime;
        }
    }
    private rules(team: TeamId) { return this.campSettings[team] ?? this.settings; }
    snapshot() {
        const runs = this.runs.map(run => ({ ...run, outlook: routeOutlook(run) }));
        const players = [...this.players.values()].map(player => ({ ...player, digReadyAt: (this.lastDig.get(player.id) ?? -this.rules(player.team).cooldownSeconds * 1000) + this.rules(player.team).cooldownSeconds * 1000 }));
        return structuredClone({ id: this.id, mode: this.mode, settings: this.settings, channels: this.channels, players, runs, queue: this.queue, hype: this.hype, rocks: this.rocks, rockRules: ROCK_RULES, rescue: { ...this.rescueLine, linked: this.linked(), camps: { a: this.campName('a'), b: this.campName('b') }, rules: RESCUE_RULES }, practice: this.practice, caves: this.caves.snapshot(), events: this.events, items: ITEMS, saveError: this.store.error });
    }
    private changed(save = false) { if (save)
        this.store.save(); this.onChange(); }
    private log(text: string) { this.events.unshift({ id: randomUUID(), text, at: this.clock() }); this.events.length = Math.min(this.events.length, 12); }
    private seedDemo() { DEMO_NAMES.forEach((name, i) => this.join(`demo:${name.toLowerCase()}`, name, i % 2 ? 'b' : 'a')); }
    setMode(mode: 'demo' | 'live') {
        if (mode === 'live' && !Object.values(this.channels).some(c => c.status === 'connected'))
            throw new Error('Connect at least one Twitch channel in Setup first.');
        this.caves.reset();
        this.id = randomUUID();
        this.sessionStartedAt = this.clock();
        this.mode = mode;
        this.players.clear();
        this.runs = [];
        this.queue = [];
        this.hype = {};
        this.rocks = [];
        this.rescueLine.reset();
        this.practice = null;
        this.lastRock = {};
        this.nextStart = 0;
        this.lastStartedTeam = null;
        this.events = [];
        this.lastDig.clear();
        if (mode === 'demo')
            this.seedDemo();
        this.log(mode === 'demo' ? 'Demo ready. Pick a viewer and start a climb.' : 'Live. Viewers can type !join and !dig in chat.');
        this.changed();
    }
    setConnection(team: TeamId, name: string | null, status: Team['connection'], note: string) {
        if (this.mode === 'live' && this.channels[team].name !== (name ?? '')) { this.rescueLine.reset(); this.caves.reset(); }
        Object.assign(this.channels[team], { name: name ?? '', status, note });
        if (this.mode === 'live' && !this.linked()) this.rescueLine.ropes = {};
        if (status !== 'connected') {
            delete this.hype[team];
            this.channels[team].hypeAvailable = false;
            this.channels[team].giftsAvailable = false;
            this.cancelRocks(team);
        }
        this.changed();
    }
    setHypeAvailable(team: TeamId, available: boolean) { this.channels[team].hypeAvailable = available; this.changed(); }
    setGiftsAvailable(team: TeamId, available: boolean) { this.channels[team].giftsAvailable = available; this.changed(); }
    join(id: string, name: string, team: TeamId) {
        if (!id.startsWith(`${this.mode === 'demo' ? 'demo' : 'twitch'}:`))
            throw new Error('Demo viewers and live viewers are separate.');
        const existing = this.players.get(id);
        if (existing && (this.queue.some(q => q.playerId === id) || this.runs.some(r => r.playerId === id))) team = existing.team;
        if (!existing && this.players.size >= 1000)
            throw new Error('This session is full. Start a new session to clear inactive viewers.');
        let profile = this.store.profiles[id];
        if (!profile)
            profile = this.store.profiles[id] = { id, name, hue: [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360, xp: 0, ore: 0, inventory: [], equipped: null, climbs: 0 };
        profile.name = name.slice(0, 25);
        const player = existing ?? { ...profile, team, lastSeen: this.clock() };
        Object.assign(player, profile, { team, lastSeen: this.clock() });
        this.players.set(id, player);
        if (!existing) {
            this.log(`${profile.name} joined the camp.`);
            this.changed(true);
        }
        return player;
    }
    private persist(player: Player) { const { team: _t, lastSeen: _s, ...profile } = player; this.store.profiles[player.id] = { ...profile, inventory: [...profile.inventory] }; }
    dig(playerId: string) {
        if (this.practice && !this.practice.done) throw new Error('Finish the rescue practice or restart the demo.');
        const p = this.players.get(playerId);
        if (!p)
            throw new Error('Join the camp first with !join.');
        if (this.runs.some(r => r.playerId === playerId) || this.queue.some(q => q.playerId === playerId))
            throw new Error(`${p.name} is already climbing or queued.`);
        const remaining = this.rules(p.team).cooldownSeconds * 1000 - (this.clock() - (this.lastDig.get(playerId) ?? -Infinity));
        if (remaining > 0)
            throw new Error(`${p.name} can climb again in ${Math.ceil(remaining / 1000)}s.`);
        if (this.queue.length >= 100)
            throw new Error('The queue is full. Try again after a climb finishes.');
        this.queue.push({ playerId, team: p.team, multiplier: this.multiplier(p.team) });
        this.lastDig.set(playerId, this.clock());
        this.log(`${p.name} is ready to climb.`);
        if (!this.paused) this.tick();
        this.changed();
    }
    prepareCave(team: TeamId, texts: unknown) {
        if (this.mode !== 'demo') throw new Error('Sample ideas are only available in demo mode. Live viewers use !idea.');
        if (this.caves.job?.status === 'drawing') throw new Error('Wait for this cave to finish.');
        if (!Array.isArray(texts) || texts.length !== 3 || texts.some(t => typeof t !== 'string' || !t.trim() || t.length > 160 || /[\x00-\x1f]/.test(t))) throw new Error('Enter three ideas, each 1–160 characters.');
        const people = [...this.players.values()].filter(p => p.team === team).slice(0, 3);
        this.caves.pools[team] = [];
        texts.forEach((text, i) => this.caves.submit(team, people[i]!.id, people[i]!.name, text));
    }
    generateCave(team: TeamId, retry = false) {
        if (this.practice && !this.practice.done) throw new Error('Finish rescue practice or return to the playground first.');
        if (this.mode === 'live' && this.channels[team].status !== 'connected') throw new Error('Connect this Twitch channel first.');
        const target = this.linked() ? otherCamp(team) : team;
        this.caves.begin({ source: team, target, fromCamp: this.campName(team), toCamp: this.campName(target) }, retry, this.random);
    }
    private multiplier(team: TeamId) { const h = this.hype[team]; return h && h.expiresAt > this.clock() ? h.multiplier : 1; }
    private campName(team: TeamId) { return this.mode === 'demo' ? `Camp ${team.toUpperCase()}` : this.channels[team].name || `Camp ${team.toUpperCase()}`; }
    private linked() {
        return this.mode === 'demo' || (Object.values(this.channels).every(c => c.status === 'connected' && c.name) && this.channels.a.name.toLowerCase() !== this.channels.b.name.toLowerCase());
    }
    private person(id: string, team: TeamId): RescuePerson {
        return { id, name: this.players.get(id)!.name, team, camp: this.campName(team) };
    }
    private awardKeepsake() {
        const camps: [string, string] = [this.campName('a'), this.campName('b')];
        const key = `${this.mode}:${camps.map(c => c.toLowerCase()).sort().join('/')}`;
        const keepsake = this.rescueLine.award(key, camps, this.clock());
        if (!keepsake) return;
        for (const person of keepsake.people) {
            const p = this.players.get(person.id);
            if (!p) continue;
            p.keepsakes = [...(p.keepsakes ?? []).filter(k => k.id !== key), keepsake].slice(-20);
            this.persist(p);
        }
        this.log(`Both camps helped! Linked Lantern earned by ${keepsake.people.map(p => p.name).join(', ')}.`);
    }
    // Explicitly scripted practice uses the same Keep/Risk, rope and reward rules.
    // It starts at the cache with no gear and a guaranteed fall; live routes never use it.
    startRescuePractice() {
        if (this.mode !== 'demo') throw new Error('Rescue practice is only available in demo mode.');
        this.setMode('demo');
        this.practice = { leg: 0, role: 'send', playerId: '', runId: '', done: false };
        this.preparePracticeRun();
        this.changed();
    }
    private preparePracticeRun() {
        const practice = this.practice!;
        const team: TeamId = (practice.leg === 0) === (practice.role === 'send') ? 'a' : 'b';
        const playerId = team === 'a' ? 'demo:noodle' : 'demo:mossboss';
        this.start({ playerId, team, multiplier: 1 });
        const run = this.runs.at(-1)!;
        Object.assign(run, { floor: 3, phase: 'choice', hp: 2, loot: 15, equipped: null, giftRocks: false, nextAt: null, message: 'Practice: start at the cache.' });
        run.rooms[3] = { kind: 'slime', label: 'Practice obstacle', ore: 9, damage: 2, chance: 1 };
        Object.assign(practice, { playerId, runId: run.id });
    }
    private advancePractice() {
        const practice = this.practice;
        if (!practice || practice.done || this.runs.length) return false;
        if (practice.role === 'send') practice.role = 'receive';
        else if (practice.leg === 0) { practice.leg = 1; practice.role = 'send'; }
        else { practice.done = true; return true; }
        this.preparePracticeRun();
        return true;
    }
    private start(q: Queued) {
        const p = this.players.get(q.playerId)!;
        const lanes = new Set(this.runs.map(r => r.lane));
        const lane = [0, 1, 2].find(i => !lanes.has(i))!;
        const shuffled = this.random() > .5;
        const rooms: Room[] = [
            { kind: 'crate', label: 'Old supply box', ore: 4, damage: 0, chance: 0 },
            { kind: 'slime', label: 'Cave slime', ore: 5, damage: 1, chance: .5 },
            { kind: 'crystal', label: 'Crystal cache', ore: 6, damage: 0, chance: 0 },
            { kind: shuffled ? 'gap' : 'slime', label: shuffled ? 'Broken ledge' : 'Crystal crab', ore: 9, damage: 2, chance: .35 },
            { kind: shuffled ? 'slime' : 'gap', label: shuffled ? 'Crystal crab' : 'Broken ledge', ore: 11, damage: 2, chance: .35 },
            { kind: 'slime', label: 'Summit guardian', ore: 15, damage: 2, chance: .35 },
        ];
        const cave = !this.practice ? this.caves.ready[q.team] : undefined;
        if (cave) {
            const upper = cave.rule === 'gaps' ? ['gap', 'gap', 'slime'] : cave.rule === 'guards' ? ['slime', 'slime', 'slime'] : ['crystal', 'slime', 'slime'];
            rooms[1]!.label = cave.enemyName;
            rooms[2]!.label = cave.cacheName;
            upper.forEach((kind, i) => Object.assign(rooms[i + 3]!, { kind, label: kind === 'slime' ? cave.enemyName : kind === 'gap' ? 'Broken ledge' : cave.cacheName, damage: kind === 'crystal' ? 0 : 2, chance: kind === 'crystal' ? 0 : .35 }));
        }
        this.runs.push({ cave: cave ? structuredClone(cave) : undefined, id: randomUUID(), playerId: p.id, team: q.team, lane, floor: 0, rooms, phase: 'climbing', hp: 3, loot: 0, item: ITEMS[Math.floor(this.random() * 3)]!.id, equipped: p.equipped, shieldUsed: false, multiplier: Math.max(q.multiplier, this.multiplier(q.team)), nextAt: this.clock() + this.settings.roomSeconds * 1000, startedAt: this.clock(), message: 'Heading up!', gainedXp: 0, giftRocks: this.rules(q.team).giftRocks, rockUsed: false });
        this.nextStart = this.clock() + 1500;
        this.lastStartedTeam = q.team;
    }
    choose(playerId: string, runId: string, choice: string) {
        const r = this.runs.find(r => r.id === runId && r.playerId === playerId);
        if (!r || r.phase !== 'choice')
            throw new Error('That choice has already ended.');
        if (this.practice && !this.practice.done && choice !== (this.practice.role === 'send' ? 'keep' : 'risk'))
            throw new Error(this.practice.role === 'send' ? 'For this practice, choose Keep to send a rope.' : 'For this practice, choose Risk to see the rescue.');
        if (choice === 'keep') {
            this.finish(r, true, 'Kept the loot.');
            if (this.linked()) {
                const rope = this.rescueLine.send(this.person(playerId, r.team), this.clock(), this.multiplier(r.team) > 1);
                if (rope) {
                    r.message = `Loot kept. Rope sent to ${this.campName(rope.to)}.`;
                    this.log(`${rope.donor.name} sent a rope to ${this.campName(rope.to)}${rope.bonusOre ? ' · Hype supply +5 ore' : ''}.`);
                }
            }
        }
        else if (choice === 'risk') {
            r.phase = 'climbing';
            r.nextAt = this.clock() + this.settings.roomSeconds * 1000;
            r.message = 'Going for the crown!';
            this.log(`${this.players.get(playerId)!.name} is risking it for the summit.`);
        }
        else
            throw new Error('Choose keep or risk.');
        this.changed(true);
    }
    private finish(r: Run, success: boolean, message: string) {
        const p = this.players.get(r.playerId)!;
        if (!success && this.linked() && !r.rescue) {
            const rescue = this.rescueLine.catch(this.person(p.id, r.team), this.clock(), r.loot, r.lane, r.floor);
            if (rescue) {
                r.rescue = rescue;
                r.loot = rescue.ore;
                success = true;
                message = `${rescue.rope.donor.name} from ${rescue.rope.donor.camp} saved your loot!`;
                this.log(`${rescue.rope.donor.name} (${rescue.rope.donor.camp}) saved ${p.name} (${rescue.recipient.camp}).`);
                this.awardKeepsake();
            }
        }
        p.climbs++;
        r.phase = success ? 'banked' : 'lost';
        r.nextAt = this.clock() + 6000;
        r.message = message;
        if (success) {
            p.ore += r.loot;
            if (r.cave && r.floor >= 3 && !p.finds?.some(f => f.id === r.cave!.id)) {
                const { id, name, findName, findPixels, credits, fromCamp } = r.cave;
                p.finds = [...(p.finds ?? []), { id, name, findName, findPixels, credits, fromCamp }].slice(-20);
                this.log(`${p.name} found ${findName}, made by ${fromCamp}!`);
                r.message += ` ${findName} saved to your backpack.`;
            }
            if (!p.inventory.includes(r.item))
                p.inventory.push(r.item);
            if (r.floor === 6 && !r.rescue && !p.inventory.includes('crown'))
                p.inventory.push('crown');
            if (!p.equipped)
                p.equipped = r.item;
            this.log(`${p.name} kept ${r.loot} ore + ${ITEMS.find(i => i.id === r.item)!.name}${r.floor === 6 && !r.rescue ? ' + Crystal crown' : ''}!`);
        }
        else
            this.log(`${p.name} fell! Unbanked loot lost; ${r.gainedXp} XP kept.`);
        this.persist(p);
    }
    tick() {
        let change = false;
        const remainingRocks = this.rocks.filter(rock => rock.status === 'warning' || rock.endsAt > this.clock());
        if (remainingRocks.length !== this.rocks.length) { this.rocks = remainingRocks; change = true; }
        for (const rock of this.rocks) {
            if (rock.status !== 'warning' || this.clock() < rock.impactAt) continue;
            this.resolveRock(rock);
            change = true;
        }
        for (const team of ['a', 'b'] as const)
            if (this.hype[team] && this.hype[team]!.expiresAt <= this.clock()) {
                delete this.hype[team];
                change = true;
            }
        for (const r of [...this.runs]) {
            if (!r.nextAt || this.clock() < r.nextAt)
                continue;
            change = true;
            if (r.phase === 'banked' || r.phase === 'lost') {
                this.runs = this.runs.filter(run => run.id !== r.id);
                continue;
            }
            if (r.phase === 'choice') {
                this.finish(r, true, 'Time’s up — loot kept safely.');
                continue;
            }
            const room = r.rooms[r.floor]!;
            const p = this.players.get(r.playerId)!;
            r.floor++;
            r.multiplier = Math.max(r.multiplier, this.multiplier(r.team));
            let hit = this.random() < room.chance;
            if (room.kind === 'gap' && r.equipped === 'boots') {
                hit = false;
                r.message = 'Spring boots cleared the gap!';
            }
            else if (hit && r.equipped === 'shield' && !r.shieldUsed) {
                hit = false;
                r.shieldUsed = true;
                r.message = 'Pebble shield blocked the hit!';
            }
            else
                r.message = hit ? `${room.label}: −${room.damage} HP` : `${room.label} cleared!`;
            if (hit)
                r.hp = Math.max(0, r.hp - room.damage);
            const oldLevel = Math.floor(p.xp / 100);
            p.xp += 15;
            r.gainedXp += 15;
            if (Math.floor(p.xp / 100) > oldLevel)
                this.log(`${p.name} reached level ${1 + Math.floor(p.xp / 100)}!`);
            this.persist(p);
            if (r.hp === 0) {
                this.finish(r, false, 'Took a tumble. XP kept!');
                continue;
            }
            r.loot += (room.ore + (r.equipped === 'lamp' ? 2 : 0)) * r.multiplier;
            if (r.floor === 6)
                this.finish(r, true, 'Summit reached! Crown collected.');
            else if (r.floor === 3) {
                r.phase = 'choice';
                r.nextAt = this.mode === 'demo' ? null : this.clock() + 45000;
                r.message = 'Keep your loot or risk the upper rooms?';
            }
            else
                r.nextAt = this.clock() + this.settings.roomSeconds * 1000;
        }
        if (!this.paused && this.runs.length < this.settings.slots && this.queue.length && this.clock() >= this.nextStart) {
            // Alternate camps when both are waiting, preserving FIFO within each camp.
            const partnerIndex = this.linked() && this.lastStartedTeam ? this.queue.findIndex(q => q.team === otherCamp(this.lastStartedTeam!)) : -1;
            this.start(this.queue.splice(Math.max(0, partnerIndex), 1)[0]!);
            change = true;
        }
        if (this.advancePractice()) change = true;
        if (change)
            this.changed(true);
    }
    equip(id: string, item: unknown) {
        const p = this.players.get(id);
        if (!p || !isItem(item) || !p.inventory.includes(item))
            throw new Error('Collect that item before equipping it.');
        p.equipped = item;
        this.persist(p);
        this.changed(true);
    }
    configure(input: Record<string, unknown>) {
        this.settings = validateSettings(input, this.settings);
        if (!this.settings.giftRocks) {
            this.cancelRocks();
            // Switching back on cannot expose a run whose choice was made with rocks off.
            for (const run of this.runs) run.giftRocks = false;
        }
        this.store.settings = { ...this.settings };
        this.changed(true);
    }
    receiveGift(event: GiftEvent, simulated = false): string {
        if (simulated !== (this.mode === 'demo') || (!simulated && this.channels[event.team].status !== 'connected'))
            return 'Gift ignored outside its live channel.';
        if (!event.id || !Number.isSafeInteger(event.total) || event.total < 1 || !Number.isFinite(event.at) || event.at < this.sessionStartedAt || event.at > this.clock() + 30000)
            return 'Gift ignored: invalid or from an earlier session.';
        const key = `${event.team}:${event.id}`;
        if (this.seenGifts.has(key)) return 'Gift already handled.';
        this.seenGifts.add(key);
        if (this.seenGifts.size > 5000) this.seenGifts.delete(this.seenGifts.values().next().value!);
        if (!this.rules(event.team).giftRocks) return 'Gift rocks are off. Enable them, then start a new climb.';
        const wait = ROCK_RULES.cooldownMs - (this.clock() - (this.lastRock[event.team] ?? -Infinity));
        if (wait > 0) return `Rock cooldown: ${Math.ceil(wait / 1000)}s left for this channel.`;
        const eligible = this.runs.filter(run => run.team === event.team && run.phase === 'climbing' && run.floor >= 3 && run.giftRocks && !run.rockUsed);
        if (!eligible.length) return 'No target yet. Start a climb with gift rocks on, then choose Risk it. Each climb can face one rock.';
        const run = eligible[Math.floor(this.random() * eligible.length)]!;
        const name = String(event.name || 'Anonymous gifter').slice(0, 25);
        const playerName = this.players.get(run.playerId)!.name;
        const impactAt = this.clock() + ROCK_RULES.warningMs;
        const message = `${simulated ? 'Simulated · ' : ''}${name} gifted ${event.total} sub${event.total === 1 ? '' : 's'} — rock above ${playerName}!`;
        this.rocks.push({ ...event, name, runId: run.id, playerName, lane: run.lane, floor: run.floor, impactAt, endsAt: impactAt + ROCK_RULES.resultMs, status: 'warning', message });
        run.rockUsed = true;
        run.nextAt = impactAt;
        run.message = 'Rock incoming! 35% chance of losing 1 HP.';
        this.lastRock[event.team] = this.clock();
        this.log(message);
        this.changed();
        return message;
    }
    private resolveRock(rock: GiftRock) {
        const run = this.runs.find(r => r.id === rock.runId && r.phase === 'climbing');
        rock.endsAt = this.clock() + ROCK_RULES.resultMs;
        if (!run || !this.rules(rock.team).giftRocks) { rock.status = 'cancelled'; rock.message = 'Rock cancelled.'; return; }
        if (this.random() >= ROCK_RULES.hitChance) {
            rock.status = 'missed';
            rock.message = `Missed ${rock.playerName}! Climb continues.`;
        } else if (run.equipped === 'shield' && !run.shieldUsed) {
            run.shieldUsed = true;
            rock.status = 'blocked';
            rock.message = `${rock.playerName} blocked the rock with a shield!`;
        } else {
            run.hp = Math.max(0, run.hp - ROCK_RULES.damage);
            rock.status = run.hp ? 'hit' : 'lost';
            rock.message = `${rock.playerName}: −1 HP.${run.hp ? ' Climb continues.' : ' Fell! XP and banked loot kept.'}`;
        }
        if (run.hp === 0) {
            this.finish(run, false, 'Hit by a gift rock. XP kept!');
            if (run.rescue) { rock.status = 'rescued'; rock.message = run.message; }
        }
        else { run.message = rock.message; run.nextAt = this.clock() + this.settings.roomSeconds * 1000; }
        this.log(rock.message);
    }
    cancelRocks(team?: TeamId) {
        for (const rock of this.rocks) {
            if (rock.status !== 'warning' || (team && rock.team !== team)) continue;
            rock.status = 'cancelled';
            rock.message = 'Rock cancelled. Climb continues.';
            rock.endsAt = this.clock() + ROCK_RULES.resultMs;
            const run = this.runs.find(r => r.id === rock.runId && r.phase === 'climbing');
            if (run) { run.message = rock.message; run.nextAt = this.clock() + this.settings.roomSeconds * 1000; }
        }
    }
    receiveHype(event: HypeEvent, simulated = false) {
        if (simulated !== (this.mode === 'demo') || !event.id || !Number.isSafeInteger(event.level) || event.level < 0 || !Number.isFinite(event.startedAt))
            return;
        const key = `${event.team}:${event.id}`;
        if (event.kind === 'end') {
            this.endedTrains.add(key);
            if (this.endedTrains.size > 1000)
                this.endedTrains.delete(this.endedTrains.values().next().value!);
            if (this.hype[event.team]?.id === event.id)
                delete this.hype[event.team];
            this.changed();
            return;
        }
        if (this.endedTrains.has(key) || !Number.isFinite(event.expiresAt) || event.expiresAt <= this.clock())
            return;
        const current = this.hype[event.team];
        if (current && (current.startedAt > event.startedAt || (current.id === event.id && current.level > event.level)))
            return;
        const multiplier = event.level >= 3 ? 3 : 2;
        this.hype[event.team] = { ...event, multiplier };
        for (const q of this.queue)
            if (q.team === event.team)
                q.multiplier = Math.max(q.multiplier, multiplier);
        for (const r of this.runs)
            if (r.team === event.team && ['climbing', 'choice'].includes(r.phase))
                r.multiplier = Math.max(r.multiplier, multiplier);
        if (!current || current.multiplier !== multiplier)
            this.log(`${simulated ? 'Simulated ' : ''}Hype Train: ${multiplier}× ore for channel ${event.team.toUpperCase()}!`);
        this.changed();
    }
    ingest(message: Omit<ChatMessage, 'at'>) {
        if (!isExpeditionCommand(message.text) || this.mode !== 'live' || message.source !== 'twitch' || this.channels[message.team].status !== 'connected' || this.seen.has(message.id))
            return;
        this.seen.add(message.id);
        if (this.seen.size > 5000)
            this.seen.delete(this.seen.values().next().value!);
        const [command, argument] = message.text.trim().toLowerCase().split(/\s+/);
        if (!['!join', '!dig', '!keep', '!risk', '!equip', '!idea'].includes(command!))
            return;
        const id = `twitch:${message.userId}`;
        try {
            if (command === '!idea') {
                this.caves.submit(message.team, id, message.name, message.text.trim().replace(/^!idea\s*/i, ''));
            }
            else if (command === '!join' || command === '!dig') {
                const isNew = !this.players.has(id);
                this.join(id, message.name, message.team);
                if (command === '!dig' || (isNew && this.rules(message.team).autoDigOnJoin))
                    this.dig(id);
            }
            else if (command === '!equip')
                this.equip(id, argument);
            else {
                const run = this.runs.find(r => r.playerId === id && r.phase === 'choice');
                if (run)
                    this.choose(id, run.id, command!.slice(1));
            }
        }
        catch { /* Repeated commands and cooldowns don't add power or flood the overlay. */ }
    }
    retrySave() { this.store.save(); this.changed(); }
}
