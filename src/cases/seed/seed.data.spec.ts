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

  it('cases up to the opening talk have an empty part I to fill by hand', () => {
    const early = seed.filter(
      (c) => c.path === 'PERIODIC' && UP_TO_OPENING_TALK.includes(c.stage),
    );
    expect(early.map((c) => c.id)).toEqual(['c-002', 'c-005', 'c-102']);
    for (const c of early) {
      expect(c.partI.topics).toEqual({
        duties: '',
        criteria: '',
        expectations: '',
        goals: '',
      });
      expect(c.partI.expectations).toEqual({});
      expect(c.partI.assessmentDue).toBeNull();
    }
  });

  it('cases later in the process keep the part I entered earlier', () => {
    for (const id of ['c-001', 'c-003', 'c-006']) {
      const c = seed.find((x) => x.id === id)!;
      expect(c.partI.confirmedByEvaluatorOn).not.toBeNull();
      expect(c.partI.topics.duties).not.toBe('');
      expect(Object.keys(c.partI.expectations).length).toBeGreaterThan(0);
      expect(c.partI.assessmentDue).not.toBeNull();
    }
  });
});
