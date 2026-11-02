import { randomUUID } from 'node:crypto';
import { Expedition, isExpeditionCommand } from './expedition.ts';
import { ProfileStore } from './expedition-store.ts';
import { DEFAULT_SETTINGS, validateSettings } from './expedition-catalog.ts';
import { CaveWorkshop, type Cave, type CaveBatch } from './expedition-caves.ts';
import { opaque, digest, TokenVault } from './hosted-auth.ts';
import type { Account, HostedData, HostedRoom, HostedStorage, Checkpoint } from './hosted-store.ts';
import type { Credentials } from './twitch.ts';
import type { ChatMessage, TeamId } from './types.ts';

export class HostedGame {
    onChange = () => {};
    readonly storage: HostedStorage;
    readonly vault: TokenVault;
    readonly maxRooms: number;
    readonly now: () => number;
    constructor(storage: HostedStorage, vault: TokenVault, maxRooms = 10, now = Date.now) {
        this.storage = storage; this.vault = vault; this.maxRooms = maxRooms; this.now = now;
    }
    async change<T>(fn: (d: HostedData) => T | Promise<T>) { const result = await this.storage.transaction(fn); this.onChange(); return result; }
    hydrate(d: Pick<HostedData, 'profiles' | 'accounts'>, room: HostedRoom) {
        const store = new ProfileStore(); store.profiles = d.profiles;
        const game = new Expedition({ store, seedDemo: false, now: this.now }); game.restore(room.game);
        room.members.forEach((id, i) => { game.campSettings[i ? 'b' : 'a'] = d.accounts[id]!.settings; });
        return game;
    }
    private roomFor(d: HostedData, id: string) {
        const account = d.accounts[id]; const room = account && d.rooms[account.room];
        if (!account || !room || !room.members.includes(id)) throw new Error('Sign in to your Twitch account.');
        return { account, room, team: (room.members.indexOf(id) ? 'b' : 'a') as TeamId };
    }
    private solo(d: HostedData, a: Account, previous?: Checkpoint, previousTeam: TeamId = 'a') {
        const g = new Expedition({ seedDemo: false, now: this.now });
        g.mode = 'live'; g.settings = { ...a.settings }; g.channels.a.name = a.login;
        if (previous) {
            const players = previous.players.filter(([, p]) => p.team === previousTeam).map(([id, p]) => [id, { ...p, team: 'a' as const }] as const);
            g.players = new Map(players); g.queue = previous.queue.filter(q => q.team === previousTeam).map(q => ({ ...q, team: 'a' }));
            const save = g.checkpoint(); save.lastDig = previous.lastDig.filter(([id]) => g.players.has(id));
            save.channels.a = previous.channels[previousTeam];
            save.caves.pools.a = previous.caves.pools[previousTeam];
            if (previous.caves.ready[previousTeam]) save.caves.ready.a = { ...previous.caves.ready[previousTeam]!, target: 'a' };
            g.restore(save);
        }
        g.paused = true;
        const r: HostedRoom = { id: randomUUID(), owner: a.id, members: [a.id], open: false, game: g.checkpoint() };
        d.rooms[r.id] = r; a.room = r.id; return r;
    }
    async signup(credentials: Credentials) {
        if (!/^\d{1,30}$/.test(credentials.id) || !/^[a-zA-Z0-9_]{1,25}$/.test(credentials.login)) throw new Error('Twitch returned an invalid account.');
        return this.change(d => {
            let a = d.accounts[credentials.id];
            if (!a) {
                a = d.accounts[credentials.id] = { id: credentials.id, login: credentials.login, overlay: opaque(), aiEnabled: false,
                    settings: { ...DEFAULT_SETTINGS }, room: '', practiceProfiles: {} };
                this.solo(d, a);
            }
            a.login = credentials.login; a.credentials = this.vault.seal(credentials);
            return a.id;
        });
    }
    async reconnect() {
        await this.change(d => {
            for (const room of Object.values(d.rooms)) {
                const game = this.hydrate(d, room); game.restore(room.game, Math.max(0, this.now() - room.game.savedAt));
                for (const c of Object.values(game.channels)) { c.status = 'offline'; c.note = c.name ? 'Reconnecting Twitch…' : 'Invite a partner to link camps.'; c.hypeAvailable = c.giftsAvailable = false; }
                if (game.caves.job?.status === 'drawing') { game.caves.job.status = 'error'; game.caves.job.error = 'Server restarted. Your ideas are saved. Retry uses another request.'; }
                room.game = game.checkpoint();
            }
        });
    }
    async channel(id: string, fn: (game: Expedition, team: TeamId) => void, deliveryId?: string, requireOpen = false) {
        return this.change(d => {
            const { room, team } = this.roomFor(d, id);
            if (requireOpen && !room.open) return;
            const key = deliveryId ? `${id}:${digest(deliveryId)}` : undefined;
            if (key && d.deliveries[key]) return;
            const game = this.hydrate(d, room); fn(game, team); room.game = game.checkpoint();
            if (key) d.deliveries[key] = this.now();
        });
    }
    async ingest(id: string, message: Omit<ChatMessage, 'at'>) {
        // Ordinary conversation never enters the database queue or delivery ledger.
        if (message.source !== 'twitch' || !isExpeditionCommand(message.text)) return;
        await this.channel(id, (game, team) => game.ingest({ ...message, team }), message.id, true);
    }
    async tick() {
        await this.change(d => {
            for (const room of Object.values(d.rooms)) {
                if (!room.open && !room.game.runs.length) continue;
                const game = this.hydrate(d, room); game.tick(); room.game = game.checkpoint();
            }
            for (const [id, at] of Object.entries(d.deliveries)) if (at < this.now() - 86400000) delete d.deliveries[id];
            for (const records of [d.sessions, d.oauth, d.invites]) for (const [id, value] of Object.entries(records)) if (value.expires < this.now()) delete records[id];
        });
    }
    async action(id: string, body: any) {
        return this.change(d => {
            const { room, account, team } = this.roomFor(d, id); const game = this.hydrate(d, room);
            if (body.sessionId !== game.id) throw new Error('The camp changed. Refresh and try again.');
            switch (body.action) {
                case 'live':
                    if (!account.credentials || game.channels[team].status !== 'connected') throw new Error('Connect Twitch before opening your camp.');
                    if (!room.open && Object.values(d.rooms).filter(r => r.open).length >= this.maxRooms) throw new Error('All camps are busy. Try practice, then open your camp again later.');
                    if (room.owner !== id && (!room.open || game.paused)) throw new Error('The inviting streamer opens the shared camp.');
                    room.open = true; game.paused = false; break;
                case 'pause':
                    if (room.owner !== id) throw new Error('Only the inviting streamer can pause the shared queue.');
                    game.paused = !game.paused; break;
                case 'close':
                    if (room.owner !== id) throw new Error('Only the inviting streamer can close the shared camp.');
                    if (game.runs.length) throw new Error('Pause new climbs and let current climbs finish first.');
                    game.paused = true; room.open = false; break;
                case 'settings': {
                    const next = validateSettings(body.settings ?? {}, account.settings);
                    if (room.members.length > 1 && ['slots', 'roomSeconds'].some(k => Object.hasOwn(body.settings ?? {}, k) && (next as any)[k] !== (game.settings as any)[k])) throw new Error('Climber count and pace stay fixed while camps are linked.');
                    account.settings = next; game.campSettings[team] = next;
                    if (room.members.length === 1) game.settings = { ...next };
                    if (!next.giftRocks) { game.cancelRocks(team); for (const run of game.runs.filter(r => r.team === team)) run.giftRocks = false; }
                    break;
                }
                case 'save': break;
                default: throw new Error('Live viewers control explorers through Twitch chat.');
            }
            room.game = game.checkpoint();
        });
    }
    async invite(id: string) {
        return this.change(d => {
            const { room } = this.roomFor(d, id);
            if (room.members.length !== 1) throw new Error('Your camp already has a partner.');
            for (const [key, invite] of Object.entries(d.invites)) if (invite.owner === id) delete d.invites[key];
            const token = opaque(); d.invites[digest(token)] = { owner: id, expires: this.now() + 86400000, rules: { ...room.game.settings } }; return token;
        });
    }
    invitation(token: string) {
        const d = this.storage.read(), invite = d.invites[digest(token)];
        if (!invite || invite.expires <= this.now()) throw new Error('This invite expired. Ask for a new one.');
        return { login: d.accounts[invite.owner]!.login, slots: invite.rules.slots, roomSeconds: invite.rules.roomSeconds };
    }
    async accept(id: string, token: string) {
        await this.change(d => {
            const invite = d.invites[digest(token)];
            if (!invite || invite.expires <= this.now() || invite.owner === id) throw new Error('This invite is invalid or expired.');
            const target = this.roomFor(d, invite.owner), source = this.roomFor(d, id);
            if (target.room.members.length !== 1 || source.room.members.length !== 1) throw new Error('One of these camps is already paired.');
            if (target.room.game.runs.length || source.room.game.runs.length) throw new Error('Both streamers must pause new climbs and let current climbs finish before linking.');
            if (target.room.game.caves.job?.status === 'drawing' || source.room.game.caves.job?.status === 'drawing') throw new Error('Wait for cave generation to finish before linking.');
            if (target.room.game.settings.slots !== invite.rules.slots || target.room.game.settings.roomSeconds !== invite.rules.roomSeconds) throw new Error('The shared rules changed. Ask for a new invite.');
            const g = this.hydrate(d, target.room), other = source.room.game;
            if (g.queue.length + other.queue.length > 100 || new Set([...g.players.keys(), ...other.players.map(([key]) => key)]).size > 1000) throw new Error('These camps exceed the shared camp capacity. Finish queued climbs before linking.');
            const existing = new Set(g.players.keys());
            if (other.queue.some(q => existing.has(q.playerId) && g.queue.some(x => x.playerId === q.playerId))) throw new Error('A viewer is queued in both camps. Let that queue finish first.');
            g.channels.b = structuredClone(other.channels.a);
            for (const [key, player] of other.players) if (!g.players.has(key)) g.players.set(key, { ...player, team: 'b' });
            for (const queued of other.queue) g.players.get(queued.playerId)!.team = 'b';
            g.queue.push(...other.queue.map(q => ({ ...q, team: 'b' as const })));
            const checkpoint = g.checkpoint(); checkpoint.lastDig = [...new Map([...checkpoint.lastDig, ...other.lastDig])];
            checkpoint.caves.pools.b = other.caves.pools.a;
            if (other.caves.ready.a) checkpoint.caves.ready.b = { ...other.caves.ready.a, target: 'b' };
            checkpoint.id = randomUUID();
            target.room.game = checkpoint; target.room.members.push(id); source.account.room = target.room.id;
            delete d.rooms[source.room.id]; delete d.invites[digest(token)];
        });
    }
    async leave(id: string) {
        await this.change(d => {
            const { room } = this.roomFor(d, id);
            if (room.members.length !== 2) throw new Error('Your camp is already solo.');
            if (room.game.runs.length || room.game.caves.job?.status === 'drawing') throw new Error('Pause new climbs and finish current climbs and drawings before unlinking.');
            const active = Object.values(d.rooms).filter(r => r.open && r.id !== room.id).length;
            room.members.forEach((member, i) => { const solo = this.solo(d, d.accounts[member]!, room.game, i ? 'b' : 'a');
                solo.open = room.open && active + i < this.maxRooms; solo.game.paused = true; });
            delete d.rooms[room.id];
        });
    }
    async prepareGeneration(id: string, retry: boolean) {
        return this.change(d => {
            const { account, room, team } = this.roomFor(d, id);
            if (!account.aiEnabled) throw new Error('AI caves are not enabled for this account. Built-in caves are free.');
            if (!room.open) throw new Error('Open your camp first.');
            const game = this.hydrate(d, room);
            let batch!: CaveBatch;
            const selector = new CaveWorkshop(async selected => { batch = selected; return new Promise<Cave>(() => {}); });
            selector.restore(game.caves.snapshot());
            const target: TeamId = room.members.length === 2 ? team === 'a' ? 'b' : 'a' : team;
            selector.begin({ source: team, target, fromCamp: account.login, toCamp: d.accounts[room.members[target === 'a' ? 0 : 1]!]!.login }, retry);
            game.caves.restore(selector.snapshot()); room.game = game.checkpoint();
            return { room: room.id, session: game.id, job: selector.job!.id, batch };
        });
    }
    async completeGeneration(job: { room: string; session: string; job: string }, cave?: Cave, error?: string) {
        await this.change(d => {
            const room = d.rooms[job.room], current = room?.game.caves.job;
            if (!room || room.game.id !== job.session || current?.id !== job.job || current.status !== 'drawing') return;
            if (!cave) { current.status = 'error'; current.error = error || 'Drawing failed. Retry your saved ideas.'; return; }
            room.game.caves.ready[cave.target] = cave; current.status = 'ready';
            const used = new Set(current.batch.ideas.map(i => i.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')));
            room.game.caves.pools[current.batch.source] = room.game.caves.pools[current.batch.source].filter(i => !used.has(i.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')));
        });
    }
    payload(id: string, overlay = false) {
        const d = this.storage.read(data => {
            const selected = this.roomFor(data, id);
            return { ...selected,
                accounts: Object.fromEntries(selected.room.members.map(member => [member, data.accounts[member]!])),
                profiles: Object.fromEntries(selected.room.game.players.flatMap(([player]) => data.profiles[player] ? [[player, data.profiles[player]!]] : [])) };
        });
        const { account, room, team } = d, state = this.hydrate(d, room).snapshot();
        state.settings = { ...account.settings, slots: room.game.settings.slots, roomSeconds: room.game.settings.roomSeconds };
        if (overlay) {
            state.caves.pools = { a: [], b: [] }; state.caves.job = null; state.saveError = null;
            // An overlay contains only information intended for broadcast.
            return { state, now: this.now() };
        }
        return { state, now: this.now(), account: { id, login: account.login, team, overlay: account.overlay, aiEnabled: account.aiEnabled },
            room: { id: room.id, open: room.open, paused: room.game.paused, owner: room.owner === id, paired: room.members.length === 2,
                partner: room.members.filter(x => x !== id).map(x => d.accounts[x]!.login)[0] ?? null } };
    }
}
