import { describe, expect, it } from 'vitest';
import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import { openingTalkDeadline } from './deadlines.rules.js';
import {
  buildNewCase,
  canStartNewCase,
  planNewCase,
} from './new-case.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = buildSeed(TODAY);
const byId = (id: string) => seed.find((c) => c.id === id)!;

describe('planNewCase', () => {
  it('starts the next periodic cycle once the assessment was acknowledged (objection term running)', () => {
    const latest = byId('c-006');
    const plan = planNewCase(latest.person, latest, TODAY);
    expect(plan).toEqual({
      path: 'PERIODIC',
      cycleStart: {
        kind: 'PREVIOUS_POSITIVE',
        assessedOn: latest.signedByEvaluatorOn,
      },
    });
  });

  it('refuses while a case is still in progress or awaiting acknowledgement', () => {
    for (const id of ['c-001', 'c-004', 'c-101']) {
      const latest = byId(id);
      expect(() => planNewCase(latest.person, latest, TODAY)).toThrow(
        CaseRuleError,
      );
      expect(canStartNewCase(latest.person, latest, TODAY)).toBe(false);
    }
  });

  it('after a negative periodic assessment: re-assessment anchored on the acknowledgement', () => {
    const latest: CaseRecord = {
      ...byId('c-006'),
      decisions: {
        wykorzystywanie_wiedzy: 1,
        rzetelnosc: 1,
        organizacja_pracy: 1,
        wspolpraca: 1,
        komunikacja: 1,
        kreatywnosc: 1,
      },
    };
    const plan = planNewCase(latest.person, latest, TODAY);
    expect(plan.cycleStart).toEqual({
      kind: 'PREVIOUS_NEGATIVE',
      assessedOn: latest.signedByEvaluatorOn,
      acknowledgedOn: latest.acknowledgedOn,
    });
  });

  it('without a case: first assessment in the first 12 months, periodic later', () => {
    const person = { ...byId('c-004').person, hiredOn: '2026-10-01' };
    expect(planNewCase(person, null, TODAY).path).toBe('FIRST');
    expect(
      planNewCase({ ...person, hiredOn: '2020-01-02' }, null, TODAY),
    ).toEqual({
      path: 'PERIODIC',
      cycleStart: { kind: 'HIRED', date: '2020-01-02' },
    });
  });
});

describe('buildNewCase', () => {
  it('periodic: OSP analysis first, OSP and evaluator carried over, opening-talk term from the rules', () => {
    const latest = byId('c-006');
    const record = buildNewCase(
      'c-200',
      latest.person,
      latest.evaluatorId,
      latest,
      TODAY,
    );
    expect(record).toMatchObject({
      id: 'c-200',
      path: 'PERIODIC',
      stage: 'OSP_ANALYSIS',
      sheetId: null,
      ospId: latest.ospId,
      evaluatorId: latest.evaluatorId,
      signedByEvaluatorOn: null,
      acknowledgedOn: null,
    });
    expect(record.previousAssessment).toMatchObject({
      result: 'POSITIVE',
      date: latest.signedByEvaluatorOn,
    });
    const opening = openingTalkDeadline(record.cycleStart).date!;
    expect(record.history[0].text).toContain('Rozpoczęto ocenę okresową');
    expect(opening > latest.signedByEvaluatorOn!).toBe(true);
  });

  it('first assessment: introductory talk first, FIRST sheet', () => {
    const person = { ...byId('c-004').person, hiredOn: '2026-11-10' };
    const record = buildNewCase('c-201', person, 'ev-kaminska', null, TODAY);
    expect(record).toMatchObject({
      path: 'FIRST',
      stage: 'INTRO_TALK',
      sheetId: 'FIRST',
      cycleStart: { kind: 'HIRED', date: '2026-11-10' },
    });
  });
});
