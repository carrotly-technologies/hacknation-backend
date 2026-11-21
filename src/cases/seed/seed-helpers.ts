import type {
  CaseRecord,
  CycleStart,
  Observation,
  PartI,
  PreviousAssessment,
  RatingPoints,
} from '../case.types.js';
import { findCompetency } from '../case.rules.js';
import { addDays, addMonths, isNonWorkingDay } from '../dates.js';
import { emptyPromotionRequest } from '../promotion.rules.js';

/** Dates relative to the demo "today". */
export function relative(today: string) {
  /** Same day or the previous working day (events happen on working days). */
  const workday = (iso: string) => {
    let date = iso;
    while (isNonWorkingDay(date)) date = addDays(date, -1);
    return date;
  };
  return {
    days: (n: number) => workday(addDays(today, n)),
    months: (n: number, extraDays = 0) =>
      workday(addDays(addMonths(today, n), extraDays)),
    workday,
  };
}

export function emptyPartI(): PartI {
  return {
    additionalCriteria: [],
    assessmentDue: null,
    topics: { duties: '', criteria: '', expectations: '', goals: '' },
    expectations: {},
    confirmedByEvaluatorOn: null,
    acknowledgedByEmployeeOn: null,
  };
}

type Required_ = Pick<
  CaseRecord,
  'id' | 'person' | 'evaluatorId' | 'path' | 'cycleStart' | 'stage'
>;

export function caseRecord(base: Required_ & Partial<CaseRecord>): CaseRecord {
  return {
    sheetId: null,
    ospId: null,
    completedOn: {},
    partI: emptyPartI(),
    observations: [],
    ratings: {},
    decisions: {},
    deviationNotes: {},
    justification: '',
    iprz: '',
    previousAssessment: null,
    promotionRequest: emptyPromotionRequest(base.person.employment),
    firstConditions: null,
    assessmentTalkOn: null,
    signedByEvaluatorOn: null,
    sentForAckOn: null,
    acknowledgedOn: null,
    history: [],
    lastReminderOn: null,
    ...base,
  };
}

/**
 * Indicator ratings of one criterion: `points` for every indicator, with
 * optional overrides (`null` = brak podstaw do oceny).
 */
export function ratingsFor(
  criterionId: string,
  points: RatingPoints,
  overrides: Record<string, RatingPoints | null> = {},
): Record<string, RatingPoints | null> {
  const competency = findCompetency(criterionId);
  if (!competency) throw new Error(`Unknown criterion ${criterionId}`);
  return Object.fromEntries(
    competency.indicators.map((i) => [
      i.id,
      i.id in overrides ? overrides[i.id] : points,
    ]),
  );
}

export function observations(
  caseId: string,
  list: Omit<Observation, 'id'>[],
): Observation[] {
  return list
    .map((o, i) => ({ id: `${caseId}-obs-${i + 1}`, ...o }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Part II item 10 for an urzędnik whose cycle started with a previous
 * assessment: result and date from `cycleStart`, the level as on the sheet.
 */
export function previousAssessment(
  cycleStart: CycleStart,
  level: string,
): PreviousAssessment {
  if (cycleStart.kind === 'HIRED') {
    throw new Error('No previous assessment for a cycle that starts on hiring');
  }
  return {
    result: cycleStart.kind === 'PREVIOUS_POSITIVE' ? 'POSITIVE' : 'NEGATIVE',
    level,
    date: cycleStart.assessedOn,
  };
}
