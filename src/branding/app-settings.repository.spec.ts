import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import type { AppSettingsRepository } from './app-settings.repository.js';
import { InMemoryAppSettingsRepository } from './in-memory-app-settings.repository.js';
import { PostgresAppSettingsRepository } from './postgres-app-settings.repository.js';

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryAppSettingsRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresAppSettingsRepository(db);
    },
  ],
] as const)('%s AppSettingsRepository', (_name, create) => {
  let repo: AppSettingsRepository;

  beforeEach(async () => {
    repo = await create();
  });

  it('returns null for a key never written', async () => {
    expect(await repo.get('logo')).toBeNull();
  });

  it('stores a JSON value and replaces it on the next put', async () => {
    const first = {
      key: 'logo',
      value: { logoId: '01-igla-w-kole', acceptedBy: { id: 'u1', name: 'A' } },
      updatedAt: '2026-11-21T10:00:00.000Z',
    };
    expect(await repo.put(first)).toEqual(first);
    expect(await repo.get('logo')).toEqual(first);

    const second = {
      key: 'logo',
      value: {
        logoId: '10-plakietka-z-roza',
        acceptedBy: { id: 'u2', name: 'B' },
      },
      updatedAt: '2026-11-21T11:00:00.000Z',
    };
    await repo.put(second);
    expect(await repo.get('logo')).toEqual(second);
    expect(await repo.get('other')).toBeNull();
  });

  it('returns copies: changing a result does not change the stored value', async () => {
    const saved = await repo.put({
      key: 'k',
      value: { a: 1 },
      updatedAt: '2026-11-21T10:00:00.000Z',
    });
    (saved.value as { a: number }).a = 2;
    expect((await repo.get('k'))?.value).toEqual({ a: 1 });
  });
});
