import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import type { UsersRepository } from '../auth/users.repository.js';
import { GENESIS_HASH } from './audit-chain.js';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import type { AuditDraft, AuditEntry } from './audit.types.js';
import { InMemoryAuditRepository } from './in-memory-audit.repository.js';
import { PostgresAuditRepository } from './postgres-audit.repository.js';

let n = 0;
const draft = (over: Partial<AuditDraft> = {}): AuditDraft => ({
  id: `e${++n}`,
  at: '2026-11-21T10:00:00.000Z',
  actorId: 'u-kaminska',
  actorRole: 'SUPERVISOR',
  action: 'CASE_PATCH',
  resourceType: 'CASE',
  resourceId: 'c-001',
  changedFields: ['ratings'],
  ip: '127.0.0.1',
  result: 'OK',
  ...over,
});

const noUsers = { list: async () => [] } as unknown as UsersRepository;

type Setup = {
  repo: AuditRepository;
  /** Changes a stored entry behind the repository's back (the test of verify). */
  tamper: (id: string) => Promise<void>;
  db?: ReturnType<typeof drizzle>;
};

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/ (trigger included).
describe.each([
  [
    'in-memory',
    async (): Promise<Setup> => {
      const repo = new InMemoryAuditRepository();
      return {
        repo,
        tamper: async (id) => {
          const entries = (repo as unknown as { entries: AuditEntry[] })
            .entries;
          entries.find((e) => e.id === id)!.changedFields = ['justification'];
        },
      };
    },
  ],
  [
    'postgres',
    async (): Promise<Setup> => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return {
        repo: new PostgresAuditRepository(db),
        db,
        tamper: async (id) => {
          await db.execute(
            sql`alter table audit_log disable trigger audit_log_no_update_delete`,
          );
          await db.execute(
            sql`update audit_log set changed_fields = '{justification}' where id = ${id}`,
          );
          await db.execute(
            sql`alter table audit_log enable trigger audit_log_no_update_delete`,
          );
        },
      };
    },
  ],
] as const)('%s AuditRepository', (name, create) => {
  let setup: Setup;
  let service: AuditService;

  beforeEach(async () => {
    setup = await create();
    service = new AuditService(setup.repo, noUsers);
  });

  it('links each entry to the previous one', async () => {
    const first = await setup.repo.append(draft());
    const second = await setup.repo.append(draft());
    expect(first).toMatchObject({ seq: 1, prevHash: GENESIS_HASH });
    expect(second).toMatchObject({ seq: 2, prevHash: first.hash });
    expect(await setup.repo.chain(0, 10)).toEqual([first, second]);
    expect(await service.verify()).toEqual({ ok: true, count: 2 });
  });

  it('parallel appends form one valid chain', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        setup.repo.append(draft({ resourceId: `c-${i}` })),
      ),
    );
    const chain = await setup.repo.chain(0, 100);
    expect(chain.map((e) => e.seq)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
    expect(await service.verify()).toEqual({ ok: true, count: 25 });
  });

  it('verify points at the first changed entry', async () => {
    await setup.repo.append(draft({ id: 'a' }));
    await setup.repo.append(draft({ id: 'b' }));
    await setup.repo.append(draft({ id: 'c' }));
    await setup.tamper('b');
    expect(await service.verify()).toEqual({
      ok: false,
      count: 1,
      firstBrokenId: 'b',
    });
  });

  it('filters by actor, action family and time, newest first, paged', async () => {
    await setup.repo.append(
      draft({ id: 'login', action: 'LOGIN', at: '2026-11-20T08:00:00.000Z' }),
    );
    await setup.repo.append(
      draft({
        id: 'send',
        action: 'CASE_ACTION:SEND_FOR_ACK',
        at: '2026-11-21T09:00:00.000Z',
      }),
    );
    await setup.repo.append(
      draft({
        id: 'sign',
        action: 'CASE_ACTION:SIGN_ASSESSMENT',
        at: '2026-11-21T10:00:00.000Z',
      }),
    );
    await setup.repo.append(
      draft({ id: 'admin', actorId: 'u-admin', action: 'DEMO_RESET' }),
    );
    const base = { offset: 0, limit: 50 };
    const ids = async (f: object) =>
      (await setup.repo.query({ ...base, ...f })).items.map((e) => e.id);

    expect(await ids({})).toEqual(['admin', 'sign', 'send', 'login']);
    expect(await ids({ actorId: 'u-admin' })).toEqual(['admin']);
    expect(await ids({ action: 'CASE_ACTION' })).toEqual(['sign', 'send']);
    expect(await ids({ action: 'CASE_ACTION:SEND_FOR_ACK' })).toEqual(['send']);
    expect(await ids({ action: 'CASE' })).toEqual([]);
    expect(
      await ids({
        from: '2026-11-21T00:00:00.000Z',
        to: '2026-11-21T09:30:00.000Z',
      }),
    ).toEqual(['send']);
    const page = await setup.repo.query({ offset: 1, limit: 2 });
    expect(page.total).toBe(4);
    expect(page.items.map((e) => e.id)).toEqual(['sign', 'send']);
  });

  if (name === 'postgres') {
    it('the trigger refuses UPDATE, DELETE and TRUNCATE of audit_log', async () => {
      await setup.repo.append(draft({ id: 'x' }));
      const db = setup.db!;
      await expect(
        db.execute(sql`update audit_log set action = 'LOGIN' where id = 'x'`),
      ).rejects.toThrow();
      await expect(
        db.execute(sql`delete from audit_log where id = 'x'`),
      ).rejects.toThrow();
      await expect(db.execute(sql`truncate audit_log`)).rejects.toThrow();
      expect(await service.verify()).toEqual({ ok: true, count: 1 });
    });
  }
});
