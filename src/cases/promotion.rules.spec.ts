import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import { formalCheck } from './formal-check.rules.js';
import { applyPatch } from './patch.rules.js';
import type { PatchCase } from './cases.schemas.js';
import { nextGrade, promotionRequestOf } from './promotion.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const DECISIONS = {
  wykorzystywanie_wiedzy: 7,
  rzetelnosc: 7,
  organizacja_pracy: 5,
  wspolpraca: 7,
  komunikacja: 5,
  myslenie_analityczne: 7,
};

const PART_III = {
  appointedYear: 2018,
  currentGrade: 'III',
  gradeGrantedOn: '2018-03-01',
  requestedGrade: 'IV',
  motivation: 'Dwie kolejne oceny powyżej oczekiwań, samodzielne opinie.',
} as const;

const invalid = (record: CaseRecord, patch: PatchCase): string[] => {
  try {
    applyPatch(record, patch, TODAY);
  } catch (error) {
    expect(error).toBeInstanceOf(CaseValidationError);
    return (error as CaseValidationError).messages;
  }
  throw new Error('expected CaseValidationError');
};

const check = (record: CaseRecord) =>
  formalCheck(record, TODAY).find((i) => i.id === 'PROMOTION_REQUEST')!;

describe('grades', () => {
  it('the next grade follows the list and the highest has none', () => {
    expect(nextGrade('I')).toBe('II');
    expect(nextGrade('VIII')).toBe('IX');
    expect(nextGrade('IX')).toBeNull();
    expect(nextGrade('X')).toBeNull();
  });
});

describe('previous assessment (part II item 10)', () => {
  it('urzędnicy past the opening talk are seeded from cycleStart', () => {
    const main = seed('c-001');
    expect(main.previousAssessment).toEqual({
      result: 'POSITIVE',
      level: 'powyżej oczekiwań',
      date:
        main.cycleStart.kind === 'PREVIOUS_POSITIVE'
          ? main.cycleStart.assessedOn
          : null,
    });
    expect(seed('c-103').previousAssessment?.result).toBe('POSITIVE');
    // Up to the opening talk everything starts empty, as the rest of the form.
    expect(seed('c-005').previousAssessment).toBeNull();
    expect(seed('c-002').previousAssessment).toBeNull(); // pracownik
    expect(seed('c-004').previousAssessment).toBeNull(); // first assessment
  });

  it('merges fields, normalises the level and validates it', () => {
    const r = applyPatch(
      seed('c-001'),
      { previousAssessment: { level: 'Na poziomie oczekiwań' } },
      TODAY,
    );
    expect(r.previousAssessment).toMatchObject({
      result: 'POSITIVE',
      level: 'na poziomie oczekiwań',
    });
    expect(
      invalid(seed('c-001'), { previousAssessment: { level: 'świetnie' } })[0],
    ).toContain('„na poziomie oczekiwań”');
    expect(
      invalid(seed('c-001'), { previousAssessment: { date: '2027-01-04' } })[0],
    ).toContain('z przyszłości');
    expect(
      applyPatch(seed('c-001'), { previousAssessment: null }, TODAY)
        .previousAssessment,
    ).toBeNull();
  });

  it('is locked outside part II and in the first assessment', () => {
    expect(() =>
      applyPatch(seed('c-003'), { previousAssessment: null }, TODAY),
    ).toThrow(CaseRuleError);
    expect(() =>
      applyPatch(seed('c-006'), { previousAssessment: null }, TODAY),
    ).toThrow(/zablokowane/);
    expect(() =>
      applyPatch(
        seed('c-004'),
        { promotionRequest: { attached: 'NO' } },
        TODAY,
      ),
    ).toThrow(/nie pierwszej oceny/);
  });
});

describe('request for the next grade (part II item 11, part III)', () => {
  it('a pracownik is always NOT_APPLICABLE and cannot answer YES or NO', () => {
    const r = seed('c-101');
    expect(promotionRequestOf(r).attached).toBe('NOT_APPLICABLE');
    expect(check(r).ok).toBe(true);
    expect(
      invalid(
        { ...r, stage: 'ASSESSMENT', signedByEvaluatorOn: null },
        { promotionRequest: { attached: 'YES' } },
      )[0],
    ).toContain('pracownikiem służby cywilnej');
  });

  it('an urzędnik answers YES or NO, not NOT_APPLICABLE', () => {
    expect(
      invalid(seed('c-001'), {
        promotionRequest: { attached: 'NOT_APPLICABLE' },
      })[0],
    ).toContain('urzędnikiem');
    expect(check(seed('c-001')).ok).toBe(false);
    const no = applyPatch(
      seed('c-001'),
      { promotionRequest: { attached: 'NO' } },
      TODAY,
    );
    expect(check(no).ok).toBe(true);
  });

  it('part III is kept only with YES and must be complete to sign', () => {
    expect(
      invalid(seed('c-001'), { promotionRequest: { motivation: 'x' } })[0],
    ).toContain('odpowiedź TAK');

    let r = applyPatch(
      seed('c-001'),
      { decisions: DECISIONS, promotionRequest: { attached: 'YES' } },
      TODAY,
    );
    expect(check(r)).toMatchObject({
      ok: false,
      message: expect.stringContaining('umotywowanie wniosku'),
    });
    r = applyPatch(r, { promotionRequest: PART_III }, TODAY);
    expect(r.promotionRequest).toEqual({ attached: 'YES', ...PART_III });
    expect(check(r)).toMatchObject({
      ok: true,
      legalBasis: expect.stringContaining('art. 89 ust. 1'),
    });

    // NO drops part III (footnote 18: not printed nor attached).
    r = applyPatch(r, { promotionRequest: { attached: 'NO' } }, TODAY);
    expect(r.promotionRequest).toMatchObject({
      attached: 'NO',
      requestedGrade: null,
      motivation: '',
    });
  });

  it('asks for the next grade only, with consistent dates', () => {
    const yes = applyPatch(
      seed('c-001'),
      { promotionRequest: { attached: 'YES' } },
      TODAY,
    );
    expect(
      invalid(yes, {
        promotionRequest: { currentGrade: 'III', requestedGrade: 'V' },
      })[0],
    ).toContain('po stopniu III jest stopień IV');
    expect(
      invalid(yes, {
        promotionRequest: { currentGrade: 'IX', requestedGrade: 'IX' },
      })[0],
    ).toContain('najwyższym');
    expect(
      invalid(yes, { promotionRequest: { appointedYear: 2027 } })[0],
    ).toContain('2026');
    expect(
      invalid(yes, {
        promotionRequest: { appointedYear: 2020, gradeGrantedOn: '2019-05-06' },
      })[0],
    ).toContain('art. 51 ust. 1');
  });

  it('YES needs a result that is not negative (§11 ust. 5)', () => {
    const negative = { ...DECISIONS, rzetelnosc: 1 };
    expect(
      invalid(seed('c-001'), {
        decisions: negative,
        promotionRequest: { attached: 'YES' },
      })[0],
    ).toContain('tylko do oceny pozytywnej');
    const r = applyPatch(
      applyPatch(
        seed('c-001'),
        { promotionRequest: { attached: 'YES' } },
        TODAY,
      ),
      { decisions: negative },
      TODAY,
    );
    expect(check(r)).toMatchObject({
      ok: false,
      message: expect.stringContaining('negatywna'),
    });
  });
});
