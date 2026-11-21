import type { CaseRecord } from './case.types.js';
import { formalCheck } from './formal-check.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const item = (record: CaseRecord, id: string, today = TODAY) =>
  formalCheck(record, today).find((i) => i.id === id);

const decided = (points: number[]): CaseRecord => {
  const r = seed('c-001');
  const ids = [
    'wykorzystywanie_wiedzy',
    'rzetelnosc',
    'organizacja_pracy',
    'wspolpraca',
    'komunikacja',
    'myslenie_analityczne',
  ];
  return {
    ...r,
    decisions: Object.fromEntries(ids.map((id, i) => [id, points[i]])),
  };
};

describe('formalCheck: periodic', () => {
  it('a fresh assessment lists the missing criteria, justification and IPRZ', () => {
    const items = formalCheck(seed('c-001'), TODAY);
    expect(items.map((i) => [i.id, i.ok])).toEqual([
      ['PART_I_CONFIRMED', true],
      ['ALL_CRITERIA_DECIDED', false],
      ['POINTS_IN_SCALE', true],
      ['ADDITIONAL_CRITERIA_CONSISTENT', true],
      ['ASSESSMENT_TALK_HELD', false],
      ['JUSTIFICATION_IF_NEGATIVE', false],
      ['IPRZ_REQUIRED', false],
      ['PROMOTION_REQUEST', false],
    ]);
    expect(item(seed('c-001'), 'ALL_CRITERIA_DECIDED')?.message).toContain(
      '„Myślenie analityczne”',
    );
    for (const i of items) expect(i.legalBasis).toBeTruthy();
  });

  it('justification is optional for a positive and required for a negative result', () => {
    expect(
      item(decided([5, 5, 5, 5, 5, 7]), 'JUSTIFICATION_IF_NEGATIVE')?.ok,
    ).toBe(true);
    const negative = decided([5, 1, 5, 5, 5, 7]); // a single 1 pkt -> NEGATIVE
    expect(item(negative, 'JUSTIFICATION_IF_NEGATIVE')).toMatchObject({
      ok: false,
      legalBasis: expect.stringContaining('§11 ust. 3–4'),
    });
    expect(
      item({ ...negative, justification: 'Opis.' }, 'JUSTIFICATION_IF_NEGATIVE')
        ?.ok,
    ).toBe(true);
  });

  it('IPRZ is always required', () => {
    const r = decided([7, 7, 7, 7, 7, 7]);
    expect(item(r, 'IPRZ_REQUIRED')?.ok).toBe(false);
    expect(item({ ...r, iprz: 'Plan rozwoju.' }, 'IPRZ_REQUIRED')?.ok).toBe(
      true,
    );
  });

  it('the assessment talk must be recorded before the signature (§10)', () => {
    const r = decided([5, 5, 5, 5, 5, 5]);
    expect(item(r, 'ASSESSMENT_TALK_HELD')).toMatchObject({
      ok: false,
      legalBasis: expect.stringContaining('§10'),
    });
    expect(
      item({ ...r, assessmentTalkOn: '2026-11-19' }, 'ASSESSMENT_TALK_HELD'),
    ).toMatchObject({
      ok: true,
      message: 'Rozmowa oceniająca przeprowadzona 19.11.2026.',
    });
  });

  it('detects criteria in part II that were not set in part I', () => {
    const r = { ...decided([5, 5, 5, 5, 5, 5]) };
    r.decisions = { ...r.decisions, kreatywnosc: 5 };
    expect(item(r, 'ADDITIONAL_CRITERIA_CONSISTENT')).toMatchObject({
      ok: false,
      message: expect.stringContaining('„Kreatywność”'),
    });
  });

  it('detects points outside the scale', () => {
    expect(item(decided([5, 5, 4, 5, 5, 5]), 'POINTS_IN_SCALE')?.ok).toBe(
      false,
    );
  });

  it('all green for a complete positive assessment', () => {
    const base = decided([5, 7, 5, 7, 5, 7]);
    const r = {
      ...base,
      iprz: 'Plan.',
      assessmentTalkOn: '2026-11-20',
      promotionRequest: { ...base.promotionRequest, attached: 'NO' as const },
    };
    expect(formalCheck(r, TODAY).every((i) => i.ok)).toBe(true);
  });
});

describe('formalCheck: first assessment', () => {
  const first = (patch: Partial<CaseRecord>): CaseRecord => ({
    ...seed('c-004'),
    decisions: {
      rzetelnosc: 5,
      wykorzystywanie_wiedzy: 5,
      organizacja_pracy: 7,
      komunikacja: 5,
      wspolpraca: 5,
    },
    ...patch,
  });

  it('requires the conditions (exam, report on time)', () => {
    const r = first({
      firstConditions: {
        examPassed: null,
        reportSubmittedOn: null,
        reportDue: '2026-11-30',
      },
    });
    const check = item(r, 'FIRST_CONDITIONS_FILLED');
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain('egzaminu');
    expect(check?.message).toContain('sprawozdania');
  });

  it('is fine once the report was submitted on time', () => {
    const r = first({
      firstConditions: {
        examPassed: 'YES',
        reportSubmittedOn: TODAY,
        reportDue: '2026-11-30',
      },
    });
    expect(formalCheck(r, TODAY).every((i) => i.ok)).toBe(true);
    expect(item(r, 'IPRZ_REQUIRED')).toBeUndefined();
  });

  it('a 9-point decision is outside the 3/5/7 scale', () => {
    const r = first({});
    r.decisions = { ...r.decisions, komunikacja: 9 };
    expect(item(r, 'POINTS_IN_SCALE')?.ok).toBe(false);
  });

  it('refuses an assessment before 8 months of work (art. 38 ust. 1)', () => {
    const r = first({});
    expect(item(r, 'FIRST_ASSESSMENT_WINDOW', '2026-11-10')).toMatchObject({
      ok: false,
      legalBasis: expect.stringContaining('art. 38 ust. 1'),
    });
    expect(item(r, 'FIRST_ASSESSMENT_WINDOW')?.ok).toBe(true);
  });
});
