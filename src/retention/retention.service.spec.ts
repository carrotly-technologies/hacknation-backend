import { ConfigService } from '@nestjs/config';
import { CaseStore } from '../cases/case-store.service.js';
import type { CasesService } from '../cases/cases.service.js';
import { InMemoryJournalRepository } from '../journal/in-memory-journal.repository.js';
import type {
  JournalNote,
  JournalObservation,
} from '../journal/journal.types.js';
import { RetentionService } from './retention.service.js';

const note = (id: string, updatedAt: string): JournalNote => ({
  id,
  personId: 'p1',
  authorId: 'a1',
  text: 'notatka',
  createdAt: updatedAt,
  updatedAt,
});
const observation = (id: string, date: string): JournalObservation => ({
  id,
  personId: 'p1',
  authorId: 'a1',
  date,
  criterionId: 'komunikacja',
  indicatorId: null,
  kind: 'STRENGTH',
  situation: 'S',
  action: 'D',
  result: 'R',
  createdAt: `${date}T10:00:00.000Z`,
  updatedAt: `${date}T10:00:00.000Z`,
});

describe('RetentionService (data with shifted dates)', () => {
  let store: CaseStore;
  let journal: InMemoryJournalRepository;
  const service = (env: Record<string, string> = {}) =>
    new RetentionService(
      new ConfigService(env),
      store as unknown as CasesService,
      journal,
    );

  beforeEach(async () => {
    store = new CaseStore(new ConfigService({ DEMO_TODAY: '2026-11-21' }));
    journal = new InMemoryJournalRepository();
    await journal.replaceAll(
      [
        note('old', '2015-06-01T10:00:00.000Z'),
        note('new', '2026-11-01T10:00:00.000Z'),
      ],
      [observation('old', '2015-06-01'), observation('new', '2026-10-01')],
    );
  });

  it('anonymizes cases that ended over 10 years ago and leaves newer ones', async () => {
    const [old, nineYears] = store.all();
    store.save({ ...old, acknowledgedOn: '2015-12-01' }); // ended 11 years ago
    store.save({ ...nineYears, acknowledgedOn: '2017-12-01' }); // 9 years ago
    const before = new Map(store.all().map((c) => [c.id, structuredClone(c)]));

    const report = await service().run();

    expect(report).toEqual({
      today: '2026-11-21',
      years: 10,
      cutoff: '2016-11-21',
      casesAnonymized: 1,
      journalNotesDeleted: 1,
      journalObservationsDeleted: 1,
    });
    expect(store.find(old.id)!.person).toMatchObject({
      id: `anon-${old.id}`,
      lastName: 'zanonimizowana',
    });
    expect(store.find(old.id)!.justification).toBe('');
    for (const c of store.all().filter((c) => c.id !== old.id)) {
      expect(c).toEqual(before.get(c.id));
    }
    expect(store.find(nineYears.id)!.person).toEqual(nineYears.person);
    expect((await journal.listNotes('p1', 'a1')).map((n) => n.id)).toEqual([
      'new',
    ]);
    expect(
      (await journal.listObservations('p1', 'a1')).map((o) => o.id),
    ).toEqual(['new']);

    // A second run finds nothing more to do.
    expect(await service().run()).toMatchObject({
      casesAnonymized: 0,
      journalNotesDeleted: 0,
      journalObservationsDeleted: 0,
    });
  });

  it('RETENTION_YEARS=0 anonymizes every ended case and no running one', async () => {
    const [ended] = store.all();
    store.save({ ...ended, acknowledgedOn: '2026-10-01' });
    const report = await service({ RETENTION_YEARS: '0' }).run();
    const anonymized = store
      .all()
      .filter((c) => c.person.id.startsWith('anon-'));
    expect(anonymized.map((c) => c.id)).toContain(ended.id);
    expect(report.casesAnonymized).toBe(anonymized.length);
    expect(
      store
        .all()
        .filter((c) => !c.acknowledgedOn)
        .every((c) => !c.person.id.startsWith('anon-')),
    ).toBe(true);
  });

  it('rejects an invalid RETENTION_YEARS at startup', () => {
    expect(() => service({ RETENTION_YEARS: 'abc' })).toThrow(
      /RETENTION_YEARS/,
    );
  });
});
