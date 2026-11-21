import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import { InMemoryJournalRepository } from './in-memory-journal.repository.js';
import type { JournalRepository } from './journal.repository.js';
import type { JournalNote, JournalObservation } from './journal.types.js';
import { PostgresJournalRepository } from './postgres-journal.repository.js';

const note = (over: Partial<JournalNote>): JournalNote => ({
  id: 'n1',
  personId: 'p1',
  authorId: 'a1',
  text: 'tekst',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

const observation = (
  over: Partial<JournalObservation>,
): JournalObservation => ({
  id: 'o1',
  personId: 'p1',
  authorId: 'a1',
  date: '2026-10-01',
  criterionId: 'komunikacja',
  indicatorId: null,
  kind: 'STRENGTH',
  situation: 'S',
  action: 'D',
  result: 'R',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryJournalRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresJournalRepository(db);
    },
  ],
] as const)('%s JournalRepository', (_name, create) => {
  let repo: JournalRepository;

  beforeEach(async () => {
    repo = await create();
  });

  it('starts empty and lists notes newest first, scoped by person and author', async () => {
    expect(await repo.isEmpty()).toBe(true);
    await repo.insertNote(note({ id: 'old' }));
    await repo.insertNote(
      note({ id: 'new', createdAt: '2026-11-02T10:00:00.000Z' }),
    );
    await repo.insertNote(note({ id: 'other-author', authorId: 'a2' }));
    await repo.insertNote(note({ id: 'other-person', personId: 'p2' }));
    expect(await repo.isEmpty()).toBe(false);
    expect((await repo.listNotes('p1', 'a1')).map((n) => n.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('updates and deletes a note of its author only', async () => {
    await repo.insertNote(note({}));
    const changes = { text: 'nowy', updatedAt: '2026-11-03T10:00:00.000Z' };
    expect(await repo.updateNote('n1', 'a2', changes)).toBeNull();
    expect(await repo.updateNote('n1', 'a1', changes)).toEqual(
      note({ text: 'nowy', updatedAt: changes.updatedAt }),
    );
    expect(await repo.deleteNote('n1', 'a2')).toBe(false);
    expect(await repo.deleteNote('n1', 'a1')).toBe(true);
    expect(await repo.deleteNote('n1', 'a1')).toBe(false);
  });

  it('lists observations by date, finds, updates and deletes by author', async () => {
    await repo.insertObservation(
      observation({ id: 'later', date: '2026-10-05' }),
    );
    await repo.insertObservation(observation({ id: 'earlier' }));
    await repo.insertObservation(
      observation({
        id: 'other',
        authorId: 'a2',
        indicatorId: 'komunikacja.1',
      }),
    );
    expect((await repo.listObservations('p1', 'a1')).map((o) => o.id)).toEqual([
      'later',
      'earlier',
    ]);
    expect(await repo.findObservation('other', 'a1')).toBeNull();
    expect(await repo.findObservation('other', 'a2')).toEqual(
      observation({
        id: 'other',
        authorId: 'a2',
        indicatorId: 'komunikacja.1',
      }),
    );
    const updated = await repo.updateObservation('earlier', 'a1', {
      kind: 'DEVELOPMENT',
      updatedAt: '2026-11-04T10:00:00.000Z',
    });
    expect(updated).toMatchObject({ kind: 'DEVELOPMENT', situation: 'S' });
    expect(await repo.deleteObservation('earlier', 'a2')).toBe(false);
    expect(await repo.deleteObservation('earlier', 'a1')).toBe(true);
  });

  it('replaceAll swaps every entry', async () => {
    await repo.insertNote(note({ id: 'gone' }));
    await repo.replaceAll([note({ id: 'seed' })], [observation({})]);
    expect((await repo.listNotes('p1', 'a1')).map((n) => n.id)).toEqual([
      'seed',
    ]);
    expect(await repo.listObservations('p1', 'a1')).toHaveLength(1);
  });
});
