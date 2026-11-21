import { describe, expect, it } from 'vitest';
import { PERIODIC_STAGES } from '../case.types.js';
import { buildSeed } from './seed.data.js';

const TODAY = '2026-11-21';
const UP_TO_OPENING_TALK: readonly string[] = PERIODIC_STAGES.slice(
  0,
  PERIODIC_STAGES.indexOf('OPENING_TALK') + 1,
);

describe('demo seed', () => {
  const seed = buildSeed(TODAY);

  it('cases up to the opening talk have an empty part I to fill by hand, without additional criteria', () => {
    const early = seed.filter(
      (c) => c.path === 'PERIODIC' && UP_TO_OPENING_TALK.includes(c.stage),
    );
    expect(early.map((c) => c.id)).toEqual(['c-002', 'c-005', 'c-102']);
    for (const c of early) {
      expect(c.partI.additionalCriteria).toEqual([]);
      expect(c.partI.topics).toEqual({
        duties: '',
        criteria: '',
        expectations: '',
        goals: '',
      });
      expect(c.partI.expectations).toEqual({});
      expect(c.partI.assessmentDue).toBeNull();
      // Part II and III fields start empty too (attached: NOT_APPLICABLE only for a pracownik).
      expect(c.previousAssessment).toBeNull();
      expect(c.promotionRequest).toEqual({
        attached: c.person.employment === 'PRACOWNIK' ? 'NOT_APPLICABLE' : null,
        appointedYear: null,
        currentGrade: null,
        gradeGrantedOn: null,
        requestedGrade: null,
        motivation: '',
      });
    }
  });

  it('cases later in the process keep the part I entered earlier', () => {
    for (const id of ['c-001', 'c-003', 'c-006', 'c-007']) {
      const c = seed.find((x) => x.id === id)!;
      expect(c.partI.additionalCriteria.length).toBeGreaterThan(0);
      expect(c.partI.confirmedByEvaluatorOn).not.toBeNull();
      expect(c.partI.topics.duties).not.toBe('');
      expect(Object.keys(c.partI.expectations).length).toBeGreaterThan(0);
      expect(c.partI.assessmentDue).not.toBeNull();
    }
  });

  it('signed cases have the assessment talk date, before the signature', () => {
    const signed = seed.filter((c) => c.signedByEvaluatorOn);
    expect(signed.length).toBeGreaterThan(0);
    for (const c of signed.filter((x) => x.path === 'PERIODIC')) {
      expect(c.assessmentTalkOn).not.toBeNull();
      expect(c.assessmentTalkOn! <= c.signedByEvaluatorOn!).toBe(true);
    }
  });
});
