import { RO_2016, RP_2015 } from '../assessments/assessment.format.js';
import {
  computeEvaluation,
  effectiveStage,
  STAGE_NAMES,
} from './case.rules.js';
import {
  type CaseRecord,
  type CaseStatus,
  type CycleStart,
  type Deadline,
  FIRST_STAGES,
  PERIODIC_STAGES,
  type StageId,
  type StageInfo,
} from './case.types.js';
import { ASSESSMENT_TALK_LEGAL_BASIS } from './assessment-talk.rules.js';
import { addMonths } from './dates.js';
import {
  assessmentDueDeadline,
  type DeadlineSpec,
  firstAssessmentDeadline,
  introTalkDeadline,
  objectionDeadline,
  openingTalkDeadline,
  reportDeadline,
  toDeadline,
  USC,
} from './deadlines.rules.js';

export const STAGE_LEGAL_BASIS: Record<StageId, string> = {
  OSP_ANALYSIS: `§3 i §5 ust. 1 pkt 1, ust. 2 ${RO_2016}`,
  SHEET_PROPOSAL: `§3 ust. 3–4, §2 ust. 2 i §5 ust. 2 ${RO_2016}`,
  OPENING_TALK: `§5–§7 ${RO_2016}`,
  OBSERVATION: `art. 81 ust. 1 ${USC}; §5 ust. 3 ${RO_2016}`,
  // Poradnik, Tabela nr 1, etap II: „wypełniony na roboczo arkusz oceny”.
  ASSESSMENT: `§11 ust. 1 pkt 1–4 ${RO_2016}`,
  // Etap III: rozmowa oceniająca przed sporządzeniem oceny na piśmie.
  ASSESSMENT_TALK: ASSESSMENT_TALK_LEGAL_BASIS,
  // Etap IV: sporządzenie oceny na piśmie z wnioskami z rozmowy (§11 ust. 2),
  // uzasadnienie (ust. 3–4), IPRZ (ust. 1 pkt 5, art. 108 ustawy).
  JUSTIFICATION: `§11 ${RO_2016}; art. 108 ${USC}`,
  DOCUMENT: `§12 ${RO_2016}; art. 83 ust. 1 ${USC}`,
  INTRO_TALK: `§3–§4 ${RP_2015}`,
  REPORT: `§4 ust. 1, §6 ${RP_2015}`,
  FIRST_ASSESSMENT: `art. 38 ust. 1–2 ${USC}; §7–§9 ${RP_2015}`,
  FIRST_CONDITIONS: `§10 ust. 1 ${RP_2015}`,
  FIRST_DOCUMENT: `§11 ${RP_2015}; art. 38 ust. 3 ${USC}`,
};

export function stageOrder(
  record: Pick<CaseRecord, 'path'>,
): readonly StageId[] {
  return record.path === 'FIRST' ? FIRST_STAGES : PERIODIC_STAGES;
}

function stageDeadlineSpec(
  record: CaseRecord,
  stage: StageId,
): DeadlineSpec | null {
  switch (stage) {
    case 'OSP_ANALYSIS':
      return {
        ...openingTalkDeadline(record.cycleStart),
        label: 'Analiza stanowiska przed rozmową rozpoczynającą, najpóźniej do',
      };
    case 'SHEET_PROPOSAL':
      return {
        ...openingTalkDeadline(record.cycleStart),
        label:
          'Akceptacja formularza przed rozmową rozpoczynającą, najpóźniej do',
      };
    case 'OPENING_TALK':
      return openingTalkDeadline(record.cycleStart);
    case 'OBSERVATION':
    case 'ASSESSMENT':
    case 'ASSESSMENT_TALK':
    case 'JUSTIFICATION':
      return assessmentDueDeadline(
        record.cycleStart,
        record.partI.assessmentDue,
      );
    case 'DOCUMENT':
      return {
        date: null,
        label: 'Zapoznanie ocenianego z oceną niezwłocznie po jej sporządzeniu',
        legalBasis: `§12 ust. 1 ${RO_2016}; art. 81 ust. 3 ${USC}`,
      };
    case 'INTRO_TALK':
      return introTalkDeadline(record.person.hiredOn);
    case 'REPORT':
      return reportDeadline(record.firstConditions?.reportDue ?? null);
    case 'FIRST_ASSESSMENT':
    case 'FIRST_CONDITIONS':
      return firstAssessmentDeadline(record.person.hiredOn);
    case 'FIRST_DOCUMENT':
      return {
        date: null,
        label: 'Zapoznanie ocenianego z oceną niezwłocznie po jej dokonaniu',
        legalBasis: `§11 ${RP_2015}`,
      };
  }
}

/** Deadline of a stage; null when the stage has no date yet. */
export function stageDeadline(
  record: CaseRecord,
  stage: StageId,
  today: string,
): Deadline | null {
  const spec = stageDeadlineSpec(record, stage);
  if (!spec) return null;
  // Stages "niezwłocznie" keep a NONE deadline; others need a date.
  if (!spec.date && stage !== 'DOCUMENT' && stage !== 'FIRST_DOCUMENT') {
    return null;
  }
  return toDeadline(spec, today);
}

/** Start of the next periodic cycle, once this assessment was made. */
export function nextCycleStart(
  record: CaseRecord,
  today: string,
): CycleStart | null {
  if (record.path !== 'PERIODIC' || !record.signedByEvaluatorOn) return null;
  const negative = computeEvaluation(record, today)?.result === 'NEGATIVE';
  if (negative && record.acknowledgedOn) {
    return {
      kind: 'PREVIOUS_NEGATIVE',
      assessedOn: record.signedByEvaluatorOn,
      acknowledgedOn: record.acknowledgedOn,
    };
  }
  return { kind: 'PREVIOUS_POSITIVE', assessedOn: record.signedByEvaluatorOn };
}

export function objectionDeadlineOf(
  record: CaseRecord,
  today: string,
): Deadline | null {
  if (record.path !== 'PERIODIC' || !record.acknowledgedOn) return null;
  return toDeadline(objectionDeadline(record.acknowledgedOn), today);
}

export function caseStatus(record: CaseRecord, today: string): CaseStatus {
  if (record.acknowledgedOn) {
    const objection = objectionDeadlineOf(record, today);
    return objection && objection.daysLeft !== null && objection.daysLeft >= 0
      ? 'OKRES_SPRZECIWU'
      : 'ZAKONCZONA';
  }
  if (record.sentForAckOn) return 'DO_ZAPOZNANIA';
  return 'W_TOKU';
}

/**
 * Date a stage was completed. Cases accepted before SHEET_PROPOSAL existed
 * chose the sheet together with the OSP analysis, so that date stands in.
 */
function completedOnOf(record: CaseRecord, id: StageId): string | null {
  const date = record.completedOn[id];
  if (date) return date;
  return id === 'SHEET_PROPOSAL'
    ? (record.completedOn.OSP_ANALYSIS ?? null)
    : null;
}

export function buildStages(record: CaseRecord, today: string): StageInfo[] {
  const order = stageOrder(record);
  const current = order.indexOf(effectiveStage(record));
  const finished = record.acknowledgedOn !== null;
  return order.map((id, index) => {
    const status =
      finished || index < current
        ? 'DONE'
        : index === current
          ? 'CURRENT'
          : index === current + 1
            ? 'UPCOMING'
            : 'LOCKED';
    return {
      id,
      name: STAGE_NAMES[id],
      status,
      deadline: status === 'DONE' ? null : stageDeadline(record, id, today),
      completedOn: status === 'DONE' ? completedOnOf(record, id) : null,
      legalBasis: STAGE_LEGAL_BASIS[id],
    };
  });
}

/**
 * The deadline that matters now: the current stage's; after the employee
 * acknowledged a periodic assessment, the objection term and then the opening
 * talk of the next cycle.
 */
export function nextDeadline(
  record: CaseRecord,
  today: string,
): Deadline | null {
  if (record.acknowledgedOn) {
    const objection = objectionDeadlineOf(record, today);
    if (objection && objection.daysLeft !== null && objection.daysLeft >= 0) {
      return objection;
    }
    const next = nextCycleStart(record, today);
    if (!next) return null;
    return toDeadline(
      {
        ...openingTalkDeadline(next),
        label: 'Nowy cykl: rozmowa rozpoczynająca (część I) do',
      },
      today,
    );
  }
  return stageDeadline(record, effectiveStage(record), today);
}

export function cycleLabel(record: CaseRecord): string {
  if (record.path === 'FIRST') return 'Pierwsza ocena';
  const anchor =
    record.cycleStart.kind === 'HIRED'
      ? record.cycleStart.date
      : record.cycleStart.assessedOn;
  const from = record.partI.acknowledgedByEmployeeOn ?? anchor;
  const negative = record.cycleStart.kind === 'PREVIOUS_NEGATIVE';
  const to = record.partI.assessmentDue ?? addMonths(from, negative ? 6 : 24);
  const years =
    from.slice(0, 4) === to.slice(0, 4)
      ? from.slice(0, 4)
      : `${from.slice(0, 4)}–${to.slice(0, 4)}`;
  return negative
    ? `Ponowna ocena okresowa (po ocenie negatywnej) ${years}`
    : `Ocena okresowa ${years}`;
}
