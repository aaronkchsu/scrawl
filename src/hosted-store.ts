import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { Expedition } from './expedition.ts';
import type { Profile } from './expedition-store.ts';
import type { ExpeditionSettings } from './expedition-catalog.ts';

export type Checkpoint = ReturnType<Expedition['checkpoint']>;
export type Account = { id: string; login: string; overlay: string; credentials?: string; aiEnabled: boolean;
    settings: ExpeditionSettings; room: string; practice?: Checkpoint; practiceProfiles: Record<string, Profile> };
export type HostedRoom = { id: string; owner: string; members: string[]; open: boolean; game: Checkpoint };
export type HostedData = {
    version: 1; accounts: Record<string, Account>; rooms: Record<string, HostedRoom>; profiles: Record<string, Profile>;
    sessions: Record<string, { account: string; expires: number }>;
    oauth: Record<string, { browser: string; expires: number }>;
    invites: Record<string, { owner: string; expires: number; rules: ExpeditionSettings }>;
    deliveries: Record<string, number>;
    usage: { requests: number; reportedRequests: number; inputTokens: number; outputTokens: number; imported: boolean };
};
export const emptyHostedData = (): HostedData => ({ version: 1, accounts: {}, rooms: {}, profiles: {}, sessions: {}, oauth: {}, invites: {}, deliveries: {},
    usage: { requests: 0, reportedRequests: 0, inputTokens: 0, outputTokens: 0, imported: false } });
export interface HostedStorage {
    read(): HostedData;
    read<T>(select: (data: HostedData) => T): T;
    transaction<T>(action: (data: HostedData) => T | Promise<T>): Promise<T>;
    close(): Promise<void>;
}
// Same transaction boundary in tests and Postgres: publish snapshots only after commit.
export class MemoryHostedStore implements HostedStorage {
    protected data: HostedData;
    protected tail: Promise<unknown> = Promise.resolve();
    constructor(initial = emptyHostedData()) { this.data = structuredClone(initial); }
    read(): HostedData;
    read<T>(select: (data: HostedData) => T): T;
    // Selectors only read committed state. Clone the selection, not every camp.
    read<T>(select?: (data: HostedData) => T): HostedData | T { return structuredClone(select ? select(this.data) : this.data); }
    transaction<T>(action: (data: HostedData) => T | Promise<T>): Promise<T> {
        const task = this.tail.then(async () => { const next = this.read(); const result = await action(next); this.data = next; return result; });
        this.tail = task.catch(() => {}); return task;
    }
    async close() { await this.tail; }
}
export type DatabaseClient = { query: (sql: string, values?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>; release?: () => void };
export class PostgresHostedStore extends MemoryHostedStore {
    readonly owner = randomUUID();
    constructor(privateClient: DatabaseClient, release: () => Promise<void>) { super(); this.client = privateClient; this.release = release; }
    private client: DatabaseClient;
    private release: () => Promise<void>;
    private disconnected = false;
    static async connect(url: string) {
        const pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 10000, query_timeout: 3000, statement_timeout: 3000 });
        const client = await pool.connect();
        const store = new PostgresHostedStore(client, async () => { client.release(); await pool.end(); });
        client.on('error', () => { store.disconnected = true; });
        try {
            try { await store.initialize(); }
            catch (error) {
                if (!(error instanceof Error) || !error.message.startsWith('Another game server')) throw error;
                await store.requestHandoff();
                for (let attempt = 0; ; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    try { await store.initialize(); break; }
                    catch (retry) { if (attempt >= 20 || !(retry instanceof Error) || !retry.message.startsWith('Another game server')) throw retry; }
                }
            }
            return store;
        } catch (e) { await store.release(); throw e; }
    }
    async initialize() {
        await this.client.query(`CREATE TABLE IF NOT EXISTS excavation_runtime (
            id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL,
            owner text, lease_until timestamptz NOT NULL DEFAULT to_timestamp(0), successor text, last_active timestamptz)`);
        await this.client.query('ALTER TABLE excavation_runtime ADD COLUMN IF NOT EXISTS successor text');
        await this.client.query('ALTER TABLE excavation_runtime ADD COLUMN IF NOT EXISTS last_active timestamptz');
        await this.client.query('CREATE TABLE IF NOT EXISTS excavation_entities (kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(kind,id))');
        await this.client.query('INSERT INTO excavation_runtime(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING', [JSON.stringify(emptyHostedData())]);
        const result = await this.client.query(`UPDATE excavation_runtime SET owner=$1, successor=NULL, lease_until=clock_timestamp()+interval '10 seconds'
            WHERE id=1 AND (lease_until<clock_timestamp() OR owner=$1) RETURNING data, last_active`, [this.owner]);
        if (!result.rows.length) throw new Error('Another game server is active. Wait for it to drain, then restart.');
        this.data = { ...result.rows[0].data, rooms: result.rows[0].data.rooms || {}, profiles: result.rows[0].data.profiles || {} };
        if (this.data.version !== 1) throw new Error('Unsupported hosted database version.');
        // Import the initial preview format before switching to per-entity writes.
        for (const kind of ['rooms', 'profiles'] as const) for (const [id, value] of Object.entries(this.data[kind]))
            await this.client.query('INSERT INTO excavation_entities(kind,id,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [kind, id, JSON.stringify(value)]);
        const entities = await this.client.query('SELECT kind,id,data FROM excavation_entities');
        for (const row of entities.rows) if (row.kind === 'rooms' || row.kind === 'profiles') (this.data[row.kind as 'rooms' | 'profiles'] as any)[row.id] = row.data;
        const lastActive = result.rows[0].last_active;
        if (lastActive) for (const room of Object.values(this.data.rooms)) room.game.savedAt = new Date(lastActive).getTime();
    }
    // A replacement process asks the old coordinator to drain before acquiring its lease.
    // This also works with Render's overlapping deploys: only the lease holder can commit.
    async requestHandoff() {
        await this.client.query('UPDATE excavation_runtime SET successor=$1 WHERE id=1 AND owner IS DISTINCT FROM $1', [this.owner]);
    }
    override transaction<T>(action: (data: HostedData) => T | Promise<T>): Promise<T> {
        const task = this.tail.then(async () => {
            if (this.disconnected) throw new Error('Database disconnected. Reconnect after the server restarts.');
            await this.client.query('BEGIN');
            try {
                const result = await this.client.query(`SELECT data, successor FROM excavation_runtime WHERE id=1 AND owner=$1
                    AND lease_until>clock_timestamp() FOR UPDATE`, [this.owner]);
                if (!result.rows.length) throw new Error('Game server lease lost. Reconnect after the server restarts.');
                if (result.rows[0].successor && result.rows[0].successor !== this.owner) {
                    await this.client.query('UPDATE excavation_runtime SET lease_until=to_timestamp(0) WHERE id=1 AND owner=$1', [this.owner]);
                    await this.client.query('COMMIT');
                    throw new Error('Game server is handing over to a deployment. Reconnect shortly.');
                }
                const next: HostedData = this.read();
                const value = await action(next);
                // The lease makes this cache authoritative. Only changed rooms/profiles are
                // written; idle ticks renew the small lease row, not every viewer's inventory.
                const encode = (kind: string, value: any) => JSON.stringify(kind === 'rooms' ? { ...value, game: { ...value.game, savedAt: 0 } } : value);
                for (const kind of ['rooms', 'profiles'] as const) {
                    for (const [id, value] of Object.entries(next[kind])) {
                        const previous = (this.data[kind] as any)[id];
                        if (previous && encode(kind, previous) === encode(kind, value)) continue;
                        await this.client.query('INSERT INTO excavation_entities(kind,id,data) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data', [kind, id, JSON.stringify(value)]);
                    }
                    for (const id of Object.keys(this.data[kind])) if (!(id in next[kind])) await this.client.query('DELETE FROM excavation_entities WHERE kind=$1 AND id=$2', [kind, id]);
                }
                const metadata = ({ rooms: _rooms, profiles: _profiles, ...rest }: HostedData) => JSON.stringify(rest);
                if (metadata(next) !== metadata(this.data) || 'rooms' in result.rows[0].data)
                    await this.client.query('UPDATE excavation_runtime SET data=$1 WHERE id=1 AND owner=$2', [metadata(next), this.owner]);
                await this.client.query("UPDATE excavation_runtime SET lease_until=clock_timestamp()+interval '10 seconds', last_active=clock_timestamp() WHERE id=1 AND owner=$1", [this.owner]);
                await this.client.query('COMMIT'); this.data = next; return value;
            } catch (e) { await this.client.query('ROLLBACK').catch(() => {}); throw e; }
        });
        this.tail = task.catch(() => {}); return task;
    }
    override async close() {
        await this.tail;
        await this.client.query('UPDATE excavation_runtime SET lease_until=to_timestamp(0),owner=NULL WHERE id=1 AND owner=$1', [this.owner]).catch(() => {});
        await this.release();
    }
}
