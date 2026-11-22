import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import {
  DEV_DATA_ENCRYPTION_KEY,
  FieldCipher,
} from '../crypto/field-cipher.js';
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
      return new PostgresJournalRepository(
        db,
        new FieldCipher(randomBytes(32)),
      );
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

  it('deleteOlderThan removes notes changed and observations dated before the cutoff', async () => {
    await repo.insertNote(
      note({ id: 'old', updatedAt: '2016-11-20T23:59:59.000Z' }),
    );
    await repo.insertNote(
      note({ id: 'kept', updatedAt: '2016-11-21T00:00:00.000Z' }),
    );
    await repo.insertObservation(
      observation({ id: 'old', date: '2016-11-20' }),
    );
    await repo.insertObservation(
      observation({ id: 'kept', date: '2016-11-21' }),
    );
    expect(await repo.deleteOlderThan('2016-11-21')).toEqual({
      notes: 1,
      observations: 1,
    });
    expect((await repo.listNotes('p1', 'a1')).map((n) => n.id)).toEqual([
      'kept',
    ]);
    expect((await repo.listObservations('p1', 'a1')).map((o) => o.id)).toEqual([
      'kept',
    ]);
    expect(await repo.deleteOlderThan('2016-11-21')).toEqual({
      notes: 0,
      observations: 0,
    });
  });
});

describe('PostgresJournalRepository encryption at rest', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;
  const cipher = new FieldCipher(randomBytes(32), [DEV_DATA_ENCRYPTION_KEY]);

  const raw = async () => ({
    notes: (
      await pg.query<{ id: string; text: string }>(
        'select id, text from journal_notes order by id',
      )
    ).rows,
    observations: (
      await pg.query<{
        id: string;
        situation: string;
        action: string;
        result: string;
      }>(
        'select id, situation, action, result from journal_observations order by id',
      )
    ).rows,
  });

  beforeEach(async () => {
    pg = new PGlite();
    db = drizzle({ client: pg });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  it('stores the note text and S-D-R as v1:… and reads them back', async () => {
    const repo = new PostgresJournalRepository(db, cipher);
    await repo.insertNote(note({ text: 'Spóźnia się z raportami.' }));
    await repo.insertObservation(
      observation({
        situation: 'Sytuacja',
        action: 'Działanie',
        result: 'Rezultat',
      }),
    );
    await repo.updateNote('n1', 'a1', {
      text: 'Poprawiona notatka',
      updatedAt: '2026-11-02T10:00:00.000Z',
    });
    await repo.updateObservation('o1', 'a1', {
      result: 'Nowy rezultat',
      updatedAt: '2026-11-02T10:00:00.000Z',
    });

    const stored = await raw();
    expect(stored.notes[0].text).toMatch(/^v1:/);
    expect(stored.notes[0].text).not.toContain('notatka');
    for (const f of ['situation', 'action', 'result'] as const) {
      expect(stored.observations[0][f]).toMatch(/^v1:/);
    }
    expect((await repo.listNotes('p1', 'a1'))[0].text).toBe(
      'Poprawiona notatka',
    );
    expect(await repo.findObservation('o1', 'a1')).toMatchObject({
      situation: 'Sytuacja',
      action: 'Działanie',
      result: 'Nowy rezultat',
    });
  });

  it('the migration encrypts existing plain rows, loses nothing and is idempotent', async () => {
    // Rows written before encryption existed, plus one under the dev key.
    await pg.query(
      `insert into journal_notes values
        ('n1','p1','a1','Jawna notatka: zażółć',now(),now()),
        ('n2','p1','a1',$1,now(),now())`,
      [
        new FieldCipher(DEV_DATA_ENCRYPTION_KEY).encrypt(
          'Notatka z kluczem dev',
        ),
      ],
    );
    await pg.query(
      `insert into journal_observations values
        ('o1','p1','a1','2026-10-01','komunikacja',null,'STRENGTH','S jawne','D jawne','R jawne',now(),now())`,
    );
    const repo = new PostgresJournalRepository(db, cipher);

    expect(await repo.encryptStoredText()).toEqual({
      notes: 2,
      observations: 1,
    });
    const first = await raw();
    expect(first.notes.every((n) => n.text.startsWith('v1:'))).toBe(true);
    expect(first.observations[0].situation).toMatch(/^v1:/);
    expect(
      (await repo.listNotes('p1', 'a1')).map((n) => n.text).sort(),
    ).toEqual(['Jawna notatka: zażółć', 'Notatka z kluczem dev']);
    expect(await repo.findObservation('o1', 'a1')).toMatchObject({
      situation: 'S jawne',
      action: 'D jawne',
      result: 'R jawne',
    });

    expect(await repo.encryptStoredText()).toEqual({
      notes: 0,
      observations: 0,
    });
    expect(await raw()).toEqual(first);
  });
});
