// Local-only hosted preview. It uses the same Postgres queries through embedded Postgres.
import { PGlite } from '@electric-sql/pglite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { PostgresHostedStore } from '../src/hosted-store.ts';
import { createHostedApp } from '../src/hosted-server.ts';
await mkdir('.runtime', { recursive: true });
let key: string;
try { key = await readFile('.runtime/preview-key', 'utf8'); }
catch { key = randomBytes(32).toString('hex'); await writeFile('.runtime/preview-key', key, { mode: 0o600, flag: 'wx' }); }
const pg = new PGlite('.runtime/hosted-preview');
const storage = new PostgresHostedStore({ query: (sql, values) => pg.query(sql, values) }, () => pg.close());
await storage.initialize();
const port = process.env.PORT || '4177';
const app = await createHostedApp({ ...process.env, PORT: port, HOST: '127.0.0.1', BASE_URL: `http://localhost:${port}`, TOKEN_ENCRYPTION_KEY: key, OPENAI_API_KEY: '' }, storage);
app.server.listen(Number(port), '127.0.0.1', () => console.log(`Hosted preview: http://localhost:${port} · AI requests disabled`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
