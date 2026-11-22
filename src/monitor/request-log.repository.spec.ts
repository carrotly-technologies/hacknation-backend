import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import { InMemoryRequestLogRepository } from './in-memory-request-log.repository.js';
import type { RequestLogEntry } from './monitor.types.js';
import { PostgresRequestLogRepository } from './postgres-request-log.repository.js';
import type { RequestLogRepository } from './request-log.repository.js';

const S1 = '11111111-1111-4111-8111-111111111111';

const entry = (over: Partial<RequestLogEntry>): RequestLogEntry => ({
  id: 'e1',
  at: '2026-11-22T10:00:00.000Z',
  sessionId: S1,
  kind: 'API',
  method: 'GET',
  path: '/api/me',
  status: 200,
  durationMs: 3,
  ip: '203.0.113.7',
  userAgent: 'UA',
  userId: 'u-1',
  userName: 'j.kowalska',
  ...over,
});

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryRequestLogRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresRequestLogRepository(db);
    },
  ],
] as const)('%s RequestLogRepository', (_name, create) => {
  let repo: RequestLogRepository;

  beforeEach(async () => {
    repo = await create();
    await repo.insert(entry({ id: 'b', at: '2026-11-22T10:05:00.000Z' }));
    await repo.insert(entry({ id: 'a' }));
    await repo.insert(
      entry({
        id: 'c',
        sessionId: null,
        at: '2026-11-21T09:00:00.000Z',
        kind: 'PAGEVIEW',
        method: null,
        status: null,
        durationMs: null,
        userId: null,
        userName: null,
      }),
    );
  });

  it('lists entries in a range, oldest first, with every field', async () => {
    const all = await repo.list({});
    expect(all.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(all[1]).toEqual(entry({ id: 'a' }));
    expect(all[0]).toMatchObject({ sessionId: null, method: null });
    expect(
      (await repo.list({ from: '2026-11-22T00:00:00.000Z' })).map((e) => e.id),
    ).toEqual(['a', 'b']);
    expect(
      (await repo.list({ to: '2026-11-22T10:00:00.000Z' })).map((e) => e.id),
    ).toEqual(['c', 'a']);
  });

  it('lists a session, and the entries without one', async () => {
    expect((await repo.listBySession(S1)).map((e) => e.id)).toEqual(['a', 'b']);
    expect((await repo.listWithoutSession({})).map((e) => e.id)).toEqual(['c']);
    expect(
      await repo.listWithoutSession({ from: '2026-11-22T00:00:00.000Z' }),
    ).toEqual([]);
  });

  it('deletes entries older than the cutoff', async () => {
    expect(await repo.deleteOlderThan('2026-11-22T00:00:00.000Z')).toBe(1);
    expect((await repo.list({})).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('deletes every entry', async () => {
    expect(await repo.deleteAll()).toBe(3);
    expect(await repo.list({})).toEqual([]);
  });
});

describe('InMemoryRequestLogRepository', () => {
  it('keeps at most maxEntries, dropping the oldest', async () => {
    const repo = new InMemoryRequestLogRepository(2);
    for (const id of ['1', '2', '3'])
      await repo.insert(entry({ id, at: `2026-11-22T10:00:0${id}.000Z` }));
    expect((await repo.list({})).map((e) => e.id)).toEqual(['2', '3']);
  });
});
