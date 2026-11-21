import type { CaseRecord } from '../cases/case.types.js';
import { buildSeed, EVALUATORS } from '../cases/seed/seed.data.js';
import { buildProfile, nextAssessment } from './people.rules.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
const evaluatorOf = (r: CaseRecord) =>
  EVALUATORS.find((e) => e.id === r.evaluatorId)!;
const profile = (records: CaseRecord[], today = TODAY) =>
  buildProfile(records, today, evaluatorOf);

describe('people.rules', () => {
  it('returns null without any visible case', () => {
    expect(profile([])).toBeNull();
  });

  it('builds the profile of a person with an open periodic case', () => {
    const p = profile([seed('c-001')])!;
    expect(p.person.id).toBe('p-nowak');
    expect(p.supervisor).toEqual({
      firstName: 'Joanna',
      lastName: 'Kamińska',
      position: 'Naczelnik wydziału',
      unit: expect.any(String),
    });
    expect(p.currentCase).toEqual({
      id: 'c-001',
      path: 'PERIODIC',
      currentStage: 'ASSESSMENT',
    });
    expect(p.nextAssessment).toBe('OKRESOWA');
    // An unsigned case has no result yet; the pre-system one comes last.
    expect(p.history).toEqual([
      expect.objectContaining({
        source: 'SYSTEM',
        caseId: 'c-001',
        status: 'W_TOKU',
        result: null,
        level: null,
      }),
      {
        source: 'EXTERNAL',
        result: 'POSITIVE',
        level: 'powyżej oczekiwań',
        date: expect.any(String),
      },
    ]);
  });

  it('shows the result and both dates of a signed and acknowledged case', () => {
    const [entry] = profile([seed('c-006')])!.history;
    expect(entry).toEqual(
      expect.objectContaining({
        source: 'SYSTEM',
        caseId: 'c-006',
        status: 'OKRES_SPRZECIWU',
        result: 'POSITIVE',
        level: expect.any(String),
        signedByEvaluatorOn: expect.any(String),
        acknowledgedOn: expect.any(String),
      }),
    );
  });

  it('a finished case is history only: no current case, periodic next', () => {
    // A year later the objection period of c-006 is long over.
    const p = profile([seed('c-006')], '2027-11-21')!;
    expect(p.history[0]).toMatchObject({ status: 'ZAKONCZONA' });
    expect(p.currentCase).toBeNull();
    expect(p.nextAssessment).toBe('OKRESOWA');
    expect(p.supervisor?.lastName).toBe('Kamińska');
  });

  it('takes the job description from the current case, null without one', () => {
    const p = profile([seed('c-001')])!;
    expect(p.osp).toEqual({
      title: expect.any(String),
      purpose: expect.any(String),
      mainTasks: expect.arrayContaining([expect.any(String)]),
    });
    expect(p.osp).not.toHaveProperty('softCompetencies');
    // The first assessment case of p-mazur has no OSP attached.
    expect(profile([seed('c-004')])!.osp).toBeNull();
  });

  it('the first assessment path asks for the first assessment', () => {
    const p = profile([seed('c-004')])!;
    expect(p.currentCase).toMatchObject({ id: 'c-004', path: 'FIRST' });
    expect(p.nextAssessment).toBe('PIERWSZA');
    expect(nextAssessment(null)).toBe('OKRESOWA');
  });

  it('orders cases newest cycle first, with the external entry of the oldest', () => {
    const older = seed('c-006');
    const newer: CaseRecord = {
      ...seed('c-002'),
      id: 'c-later',
      person: older.person,
      cycleStart: {
        kind: 'PREVIOUS_POSITIVE',
        assessedOn: older.signedByEvaluatorOn!,
      },
      previousAssessment: {
        result: 'POSITIVE',
        level: 'powyżej oczekiwań',
        date: older.signedByEvaluatorOn,
      },
    };
    const p = profile([older, newer], '2027-11-21')!;
    expect(
      p.history.map((h) => (h.source === 'SYSTEM' ? h.caseId : h.source)),
    ).toEqual(['c-later', 'c-006', 'EXTERNAL']);
    expect(p.history[2]).toMatchObject({ level: 'na poziomie oczekiwań' });
    expect(p.currentCase?.id).toBe('c-later');
  });
});
