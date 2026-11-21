import {
  ACTION_LABELS,
  applyAction,
  availableActions,
} from './actions.rules.js';
import { effectiveStage, STAGE_NAMES } from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type { CaseAction, CaseRecord } from './case.types.js';
import { applyPatch } from './patch.rules.js';
import { buildSeed } from './seed/seed.data.js';
import { buildStages, caseStatus, nextDeadline } from './stages.rules.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const run = (record: CaseRecord, ...actions: CaseAction[]) =>
  actions.reduce((r, a) => applyAction(r, a, TODAY), record);

const conflict = (fn: () => unknown): CaseRuleError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CaseRuleError);
    return error as CaseRuleError;
  }
  throw new Error('expected CaseRuleError');
};

/** Decides every criterion of the main case (sheet C + myślenie analityczne). */
const decideAll = (record: CaseRecord, points = 5) =>
  applyPatch(
    record,
    {
      decisions: {
        wykorzystywanie_wiedzy: points,
        rzetelnosc: points,
        organizacja_pracy: points,
        wspolpraca: points,
        komunikacja: points,
        myslenie_analityczne: points,
      },
    },
    TODAY,
  );

describe('periodic state machine', () => {
  it('runs the whole path from OSP analysis to the next cycle', () => {
    let r = seed('c-002');
    expect(effectiveStage(r)).toBe('OSP_ANALYSIS');
    expect(availableActions(r, TODAY)).toEqual(['ACCEPT_OSP_ANALYSIS']);

    r = run(r, 'ACCEPT_OSP_ANALYSIS');
    expect(r.sheetId).toBe('C'); // from "brak podległych pracowników"
    expect(effectiveStage(r)).toBe('SHEET_PROPOSAL');
    expect(availableActions(r, TODAY)).toEqual(['ACCEPT_SHEET']);

    // "Wprowadź zmiany": the sheet and criteria stay editable until accepted.
    r = applyPatch(
      r,
      { partI: { additionalCriteria: ['myslenie_analityczne'] } },
      TODAY,
    );
    r = run(r, 'ACCEPT_SHEET');
    expect(effectiveStage(r)).toBe('OPENING_TALK');
    expect(r.completedOn.SHEET_PROPOSAL).toBe(TODAY);
    r = run(r, 'CONFIRM_PART_I');
    expect(r.partI.confirmedByEvaluatorOn).toBe(TODAY);
    expect(r.partI.assessmentDue).toBe('2028-11-21'); // +24 months

    r = run(r, 'EMPLOYEE_ACK_PART_I', 'START_ASSESSMENT');
    expect(effectiveStage(r)).toBe('ASSESSMENT');
    expect(r.history.at(-1)!.text).toBe(
      'Otwarto formularz oceny kompetencji (część II arkusza).',
    );

    r = decideAll(r);
    expect(effectiveStage(r)).toBe('ASSESSMENT_TALK');
    expect(availableActions(r, TODAY)).toEqual(['RECORD_ASSESSMENT_TALK']);
    r = run(r, 'RECORD_ASSESSMENT_TALK');
    expect(effectiveStage(r)).toBe('JUSTIFICATION');
    expect(r.assessmentTalkOn).toBe(TODAY);
    expect(r.completedOn.ASSESSMENT_TALK).toBe(TODAY);
    r = applyPatch(r, { iprz: 'Szkolenie z analizy ryzyka.' }, TODAY);
    r = run(r, 'SIGN_ASSESSMENT');
    expect(effectiveStage(r)).toBe('DOCUMENT');
    expect(r.signedByEvaluatorOn).toBe(TODAY);
    expect(r.completedOn.JUSTIFICATION).toBe(TODAY);

    r = run(r, 'SEND_FOR_ACK');
    expect(caseStatus(r, TODAY)).toBe('DO_ZAPOZNANIA');
    r = run(r, 'EMPLOYEE_ACK_ASSESSMENT');
    expect(caseStatus(r, TODAY)).toBe('OKRES_SPRZECIWU');
    expect(nextDeadline(r, TODAY)).toMatchObject({
      date: '2026-11-30', // 28.11 is a Saturday
      legalBasis: expect.stringContaining('art. 83 ust. 1'),
    });
    expect(r.history.at(-1)!.text).toContain('Nowy cykl oceny');
    expect(r.history.at(-1)!.text).toContain('30 dni');
    expect(buildStages(r, TODAY).every((s) => s.status === 'DONE')).toBe(true);
    expect(caseStatus(r, '2026-12-01')).toBe('ZAKONCZONA');
    expect(nextDeadline(r, '2026-12-01')?.label).toContain('Nowy cykl');
  });

  it('a negative assessment starts a 7-day opening talk and a 6-month re-assessment', () => {
    let r = decideAll(seed('c-001'), 3);
    r = applyPatch(
      r,
      {
        iprz: 'Plan.',
        justification: 'Uzasadnienie.',
        promotionRequest: { attached: 'NO' },
      },
      TODAY,
    );
    r = run(
      r,
      'RECORD_ASSESSMENT_TALK',
      'SIGN_ASSESSMENT',
      'SEND_FOR_ACK',
      'EMPLOYEE_ACK_ASSESSMENT',
    );
    const text = r.history.at(-1)!.text;
    expect(text).toContain('§7 pkt 2');
    expect(text).toContain('art. 81 ust. 9');
  });

  it('marks stages DONE / CURRENT / UPCOMING / LOCKED', () => {
    const stages = buildStages(seed('c-001'), TODAY);
    expect(stages.map((s) => s.status)).toEqual([
      'DONE',
      'DONE',
      'DONE',
      'DONE',
      'CURRENT',
      'UPCOMING',
      'LOCKED',
      'LOCKED',
    ]);
    // Seeded before the stage existed: falls back to the OSP analysis date.
    expect(stages[1]).toMatchObject({
      id: 'SHEET_PROPOSAL',
      completedOn: stages[0].completedOn,
    });
    expect(stages[4].deadline).toMatchObject({
      date: '2026-12-04',
      state: 'SOON',
    });
  });
});

describe('illegal transitions', () => {
  it.each<[string, CaseAction, string]>([
    ['c-002', 'CONFIRM_PART_I', 'analizę opisu stanowiska'],
    ['c-002', 'ACCEPT_SHEET', 'Najpierw zatwierdź analizę'],
    ['c-001', 'ACCEPT_SHEET', 'już zaakceptowany'],
    ['c-004', 'ACCEPT_SHEET', 'tylko oceny okresowej'],
    [
      'c-002',
      'SIGN_ASSESSMENT',
      'dopiero w otwartym formularzu oceny kompetencji',
    ],
    ['c-001', 'CONFIRM_PART_I', 'już zatwierdzona'],
    ['c-001', 'EMPLOYEE_ACK_ASSESSMENT', 'po jej zatwierdzeniu'],
    ['c-005', 'EMPLOYEE_ACK_PART_I', 'Najpierw oceniający zatwierdza część I'],
    ['c-001', 'REPORT_SUBMITTED', 'tylko pierwszej oceny'],
    ['c-004', 'ACCEPT_OSP_ANALYSIS', 'tylko oceny okresowej'],
    ['c-006', 'SEND_FOR_ACK', 'Ocena jest zakończona'],
  ])('%s: %s -> 409 (%s)', (id, action, fragment) => {
    const error = conflict(() => applyAction(seed(id), action, TODAY));
    expect(error.message).toContain(fragment);
    expect(error.message).toMatch(/^Akcja „.+” jest teraz niedostępna\./);
  });

  it('lists the actions that are available instead', () => {
    const error = conflict(() =>
      applyAction(seed('c-005'), 'START_ASSESSMENT', TODAY),
    );
    expect(error.message).toContain('Dostępne teraz: „Zatwierdź część I”');
  });

  it('SIGN_ASSESSMENT is refused with the failing formal checks', () => {
    const r = run(decideAll(seed('c-001'), 3), 'RECORD_ASSESSMENT_TALK');
    const error = conflict(() => applyAction(r, 'SIGN_ASSESSMENT', TODAY));
    expect(error.formalCheck?.map((f) => f.id)).toEqual([
      'JUSTIFICATION_IF_NEGATIVE',
      'IPRZ_REQUIRED',
      'PROMOTION_REQUEST',
    ]);
  });
});

describe('first assessment state machine', () => {
  it('runs report -> assessment -> conditions -> document', () => {
    let r = run(seed('c-004'), 'REPORT_SUBMITTED');
    expect(r.firstConditions?.reportSubmittedOn).toBe(TODAY);
    expect(effectiveStage(r)).toBe('FIRST_ASSESSMENT');
    r = applyPatch(
      r,
      {
        decisions: {
          rzetelnosc: 5,
          wykorzystywanie_wiedzy: 5,
          organizacja_pracy: 7,
          komunikacja: 5,
          wspolpraca: 5,
        },
      },
      TODAY,
    );
    expect(effectiveStage(r)).toBe('FIRST_CONDITIONS');
    r = run(r, 'SIGN_ASSESSMENT', 'SEND_FOR_ACK', 'EMPLOYEE_ACK_ASSESSMENT');
    expect(caseStatus(r, TODAY)).toBe('ZAKONCZONA'); // no objection (art. 83 is periodic only)
    expect(r.history.at(-1)!.text).toContain('art. 38 ust. 3');
  });

  it('START_ASSESSMENT before the report due date is refused', () => {
    const error = conflict(() =>
      applyAction(seed('c-004'), 'START_ASSESSMENT', TODAY),
    );
    expect(error.message).toContain('§7 pkt 1');
    // after the due date without a report it is allowed
    const later = applyAction(seed('c-004'), 'START_ASSESSMENT', '2026-12-01');
    expect(effectiveStage(later)).toBe('FIRST_ASSESSMENT');
  });

  it('COMPLETE_INTRO_TALK sets a default report due date', () => {
    const r = run(seed('c-104'), 'COMPLETE_INTRO_TALK');
    expect(effectiveStage(r)).toBe('REPORT');
    expect(r.firstConditions?.reportDue).toBe('2027-07-23');
  });
});

describe('patch locks and validation', () => {
  it('part I is locked after confirmation', () => {
    const error = conflict(() =>
      applyPatch(seed('c-001'), { partI: { additionalCriteria: [] } }, TODAY),
    );
    expect(error.message).toContain('Część I jest zablokowana');
  });

  it('part II is a draft before the assessment talk (OBSERVATION)', () => {
    const r = applyPatch(
      seed('c-003'),
      {
        ratings: { wykorzystywanie_wiedzy: { 'wykorzystywanie_wiedzy.1': 7 } },
        decisions: { wykorzystywanie_wiedzy: 7 },
        deviationNotes: { wykorzystywanie_wiedzy: 'Notatka robocza.' },
        justification: 'Uzasadnienie robocze.',
        iprz: 'Szkolenie z negocjacji.',
        previousAssessment: { level: 'na poziomie oczekiwań' },
        promotionRequest: { attached: 'NO' },
      },
      TODAY,
    );
    expect(r).toMatchObject({
      stage: 'OBSERVATION',
      decisions: { wykorzystywanie_wiedzy: 7 },
      ratings: { wykorzystywanie_wiedzy: { 'wykorzystywanie_wiedzy.1': 7 } },
      justification: 'Uzasadnienie robocze.',
      iprz: 'Szkolenie z negocjacji.',
      promotionRequest: { attached: 'NO' },
    });
    expect(r.completedOn.ASSESSMENT).toBeUndefined();
    // Signing still needs the competency form opened (START_ASSESSMENT).
    expect(conflict(() => run(r, 'SIGN_ASSESSMENT')).message).toContain(
      'dopiero w otwartym formularzu oceny kompetencji',
    );
  });

  it('part II is a draft at the opening talk; criteria leaving part I are dropped', () => {
    let r = applyPatch(
      seed('c-005'),
      {
        partI: { additionalCriteria: ['kreatywnosc'] },
        decisions: { komunikacja: 5, kreatywnosc: 7 },
        ratings: { kreatywnosc: { 'kreatywnosc.1': 7 } },
      },
      TODAY,
    );
    expect(r.decisions).toEqual({ komunikacja: 5, kreatywnosc: 7 });
    r = applyPatch(r, { partI: { additionalCriteria: [] } }, TODAY);
    expect(r.decisions).toEqual({ komunikacja: 5 });
    expect(r.ratings).toEqual({});
  });

  it('part II needs a sheet: refused at the OSP analysis', () => {
    const error = conflict(() =>
      applyPatch(seed('c-002'), { iprz: 'x' }, TODAY),
    );
    expect(error.message).toContain('gdy wybrany jest arkusz');
  });

  it('part II is locked after the evaluator signed', () => {
    const signed = run(
      applyPatch(
        decideAll(seed('c-001')),
        { iprz: 'Szkolenie.', promotionRequest: { attached: 'NO' } },
        TODAY,
      ),
      'RECORD_ASSESSMENT_TALK',
      'SIGN_ASSESSMENT',
    );
    for (const patch of [
      { decisions: { komunikacja: 7 } },
      { ratings: { komunikacja: { 'komunikacja.1': 7 as const } } },
      { justification: 'Po podpisie.' },
      { iprz: 'Po podpisie.' },
    ]) {
      expect(
        conflict(() => applyPatch(signed, patch, TODAY)).message,
      ).toContain('zablokowane');
    }
  });

  it('first assessment: part II still opens with the assessment stage', () => {
    expect(
      conflict(() =>
        applyPatch(seed('c-104'), { decisions: { komunikacja: 5 } }, TODAY),
      ).message,
    ).toContain('sprawozdania');
  });

  it('rejects more than 3, mandatory or unknown additional criteria (400)', () => {
    expect(() =>
      applyPatch(
        seed('c-005'),
        {
          partI: {
            additionalCriteria: [
              'kreatywnosc',
              'negocjowanie',
              'myslenie_analityczne',
              'komunikacja',
            ],
          },
        },
        TODAY,
      ),
    ).toThrow(/najwyżej 3.*obowiązkowe w arkuszu C/s);
  });

  it('rejects points outside the sheet scale', () => {
    expect(() =>
      applyPatch(seed('c-001'), { decisions: { komunikacja: 4 } }, TODAY),
    ).toThrow('1, 3, 5, 7 lub 9');
  });
});

describe('step 4 is the assessment form, not a talk screen', () => {
  it('names the stages and the action after the form', () => {
    expect(STAGE_NAMES.ASSESSMENT).toBe('Formularz oceny kompetencji');
    expect(STAGE_NAMES.FIRST_ASSESSMENT).toBe('Formularz pierwszej oceny');
    expect(ACTION_LABELS.START_ASSESSMENT).toBe(
      'Przejdź do formularza oceny kompetencji',
    );
  });

  it('a first-assessment field before the form opens names the form', () => {
    const error = conflict(() =>
      applyPatch(seed('c-004'), { decisions: { rzetelnosc: 5 } }, TODAY),
    );
    expect(error.message).toContain('formularzu pierwszej oceny');
    expect(error.message).not.toContain('rozmowy oceniającej');
  });
});

describe('assessment talk (etap III) and form verification (etap IV)', () => {
  it('names the stages after the Poradnik, Tabela nr 1', () => {
    expect(STAGE_NAMES.ASSESSMENT_TALK).toBe('Rozmowa oceniająca');
    expect(STAGE_NAMES.JUSTIFICATION).toBe('Weryfikacja formularza');
    expect(ACTION_LABELS.RECORD_ASSESSMENT_TALK).toBe(
      'Rozmowa oceniająca przeprowadzona',
    );
    const stages = buildStages(seed('c-007'), TODAY);
    expect(stages.map((s) => s.id)).toEqual([
      'OSP_ANALYSIS',
      'SHEET_PROPOSAL',
      'OPENING_TALK',
      'OBSERVATION',
      'ASSESSMENT',
      'ASSESSMENT_TALK',
      'JUSTIFICATION',
      'DOCUMENT',
    ]);
    expect(stages[5]).toMatchObject({
      status: 'CURRENT',
      legalBasis: '§10 rozp. PRM z 4.04.2016',
      deadline: { label: expect.any(String) },
    });
    expect(stages[6].legalBasis).toContain('§11');
  });

  it('a seeded case with every criterion rated is at the talk', () => {
    const r = seed('c-007');
    expect(effectiveStage(r)).toBe('ASSESSMENT_TALK');
    expect(availableActions(r, TODAY)).toEqual(['RECORD_ASSESSMENT_TALK']);
  });

  it('SIGN_ASSESSMENT needs the recorded talk (§10)', () => {
    const error = conflict(() =>
      applyAction(seed('c-007'), 'SIGN_ASSESSMENT', TODAY),
    );
    expect(error.message).toContain('Najpierw odnotuj rozmowę oceniającą (§10');
  });

  it('records the date given, not in the future and not before part I', () => {
    const r = applyAction(seed('c-007'), 'RECORD_ASSESSMENT_TALK', TODAY, {
      date: '2026-11-19',
    });
    expect(r).toMatchObject({
      assessmentTalkOn: '2026-11-19',
      completedOn: { ASSESSMENT_TALK: '2026-11-19' },
    });
    expect(effectiveStage(r)).toBe('JUSTIFICATION');
    expect(r.history.at(-1)).toMatchObject({
      date: TODAY,
      text: expect.stringContaining('19.11.2026'),
    });
    expect(availableActions(r, TODAY)).toContain('SIGN_ASSESSMENT');

    expect(() =>
      applyAction(seed('c-007'), 'RECORD_ASSESSMENT_TALK', TODAY, {
        date: '2026-11-22',
      }),
    ).toThrow(CaseValidationError);
    expect(() =>
      applyAction(seed('c-007'), 'RECORD_ASSESSMENT_TALK', TODAY, {
        date: '2020-01-02',
      }),
    ).toThrow(/wcześniejsza niż zapoznanie ocenianego z częścią I/);
  });

  it('is recorded once, and only after every criterion is rated', () => {
    const done = run(seed('c-007'), 'RECORD_ASSESSMENT_TALK');
    expect(
      conflict(() => run(done, 'RECORD_ASSESSMENT_TALK')).message,
    ).toContain('odnotowano już');
    expect(
      conflict(() => run(seed('c-001'), 'RECORD_ASSESSMENT_TALK')).message,
    ).toContain('najpierw wpisz oceny cząstkowe');
    expect(
      conflict(() => run(seed('c-004'), 'RECORD_ASSESSMENT_TALK')).message,
    ).toContain('tylko oceny okresowej');
  });

  it('the form stays editable after the talk, until the signature', () => {
    const r = applyPatch(
      run(seed('c-007'), 'RECORD_ASSESSMENT_TALK'),
      { decisions: { komunikacja: 5 }, justification: 'Po rozmowie.' },
      TODAY,
    );
    expect(effectiveStage(r)).toBe('JUSTIFICATION');
    expect(r.decisions.komunikacja).toBe(5);
    // Clearing a decision goes back to the form; the talk date stays.
    const back = applyPatch(r, { decisions: { komunikacja: null } }, TODAY);
    expect(effectiveStage(back)).toBe('ASSESSMENT');
    expect(back.assessmentTalkOn).toBe(TODAY);
  });
});
