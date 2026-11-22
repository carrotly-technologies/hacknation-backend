import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import {
  objectionLastDay,
  objectionOpen,
  submitObjection,
} from './objection.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
/** Periodic assessment acknowledged on Wednesday 18.11.2026. */
const acknowledged = (): CaseRecord => ({
  ...seed('c-101'),
  acknowledgedOn: '2026-11-18',
});

describe('objection rules (art. 83 ust. 1)', () => {
  it('runs 7 days from the acknowledgement', () => {
    expect(objectionLastDay(acknowledged())).toBe('2026-11-25');
    expect(objectionOpen(acknowledged(), '2026-11-25')).toBe(true);
    expect(objectionOpen(acknowledged(), '2026-11-26')).toBe(false);
  });

  it('records the objection once, with a history entry', () => {
    const next = submitObjection(acknowledged(), 'Nie zgadzam się.', TODAY);
    expect(next.objection).toEqual({
      text: 'Nie zgadzam się.',
      submittedOn: TODAY,
    });
    expect(next.history.at(-1)).toEqual({
      date: TODAY,
      text: 'Oceniany wniósł sprzeciw od oceny 21.11.2026.',
    });
    expect(objectionOpen(next, TODAY)).toBe(false);
    expect(() => submitObjection(next, 'Jeszcze raz', TODAY)).toThrow(
      /już przekazane 21\.11\.2026/,
    );
  });

  it('refuses before the acknowledgement, after the term and for a first assessment', () => {
    expect(() => submitObjection(seed('c-101'), 'x', TODAY)).toThrow(
      CaseRuleError,
    );
    expect(objectionOpen(seed('c-101'), TODAY)).toBe(false);
    expect(() => submitObjection(acknowledged(), 'x', '2026-11-26')).toThrow(
      /Termin na sprzeciw minął 25\.11\.2026/,
    );
    const first: CaseRecord = {
      ...acknowledged(),
      path: 'FIRST',
    };
    expect(objectionLastDay(first)).toBeNull();
    expect(() => submitObjection(first, 'x', TODAY)).toThrow(
      /tylko od oceny okresowej/,
    );
  });
});
