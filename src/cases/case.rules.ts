import { displayName } from '../assessments/assessment.format.js';
import {
  evaluate,
  type EvaluateResult,
  validateEvaluation,
} from '../assessments/evaluate.rules.js';
import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import type { Competency } from '../competency-model/competency-model.types.js';
import { SHEETS } from '../sheets/sheets.data.js';
import type { Sheet } from '../sheets/sheet.types.js';
import type { CaseRecord, FirstConditions, StageId } from './case.types.js';

export function findCompetency(id: string): Competency | undefined {
  return COMPETENCY_MODEL.competencies.find((c) => c.id === id);
}

/** "Rzetelność"; the id itself when unknown. */
export function criterionName(id: string): string {
  const competency = findCompetency(id);
  return competency ? displayName(competency.name) : id;
}

export function knownCriterionName(id: string): string | undefined {
  const competency = findCompetency(id);
  return competency ? displayName(competency.name) : undefined;
}

export function sheetOf(record: Pick<CaseRecord, 'sheetId'>): Sheet | null {
  return SHEETS.find((s) => s.id === record.sheetId) ?? null;
}

/** Criteria assessed in part II: mandatory of the sheet + part I additional. */
export function caseCriteria(
  record: Pick<CaseRecord, 'sheetId' | 'partI'>,
): string[] {
  const sheet = sheetOf(record);
  if (!sheet) return [];
  if (sheet.kind === 'FIRST') return [...sheet.mandatoryCriteria];
  return [...sheet.mandatoryCriteria, ...record.partI.additionalCriteria];
}

export function allDecided(record: CaseRecord): boolean {
  const criteria = caseCriteria(record);
  return (
    criteria.length > 0 && criteria.every((id) => record.decisions[id] != null)
  );
}

/** Whether the first-assessment report was on time; null while undecided. */
export function reportOnTime(
  conditions: FirstConditions | null,
  today: string,
): boolean | null {
  if (!conditions) return null;
  const { reportSubmittedOn, reportDue } = conditions;
  if (reportSubmittedOn)
    return reportDue ? reportSubmittedOn <= reportDue : null;
  if (reportDue && today > reportDue) return false;
  return null;
}

/**
 * Result computed with the v1 rules once every criterion has a decision (and,
 * for FIRST, both conditions are known); null otherwise.
 */
export function computeEvaluation(
  record: CaseRecord,
  today: string,
): EvaluateResult | null {
  const sheet = sheetOf(record);
  if (!sheet || !allDecided(record)) return null;
  const scores = caseCriteria(record).map((criterionId) => ({
    criterionId,
    points: record.decisions[criterionId],
  }));
  let first: Parameters<typeof evaluate>[2];
  if (sheet.kind === 'FIRST') {
    const onTime = reportOnTime(record.firstConditions, today);
    const exam = record.firstConditions?.examPassed;
    if (!exam || onTime === null) return null;
    first = { examPassed: exam, reportSubmittedOnTime: onTime };
  }
  if (validateEvaluation(sheet, scores, first, knownCriterionName).length > 0) {
    return null;
  }
  return evaluate(
    sheet,
    scores,
    first,
    knownCriterionName,
    COMPETENCY_MODEL.scale,
  );
}

/**
 * The current stage. The store keeps ASSESSMENT / FIRST_ASSESSMENT for the
 * whole part II; once every criterion is decided, the case is in
 * JUSTIFICATION / FIRST_CONDITIONS.
 */
export function effectiveStage(record: CaseRecord): StageId {
  if (record.stage === 'ASSESSMENT' && allDecided(record))
    return 'JUSTIFICATION';
  if (record.stage === 'FIRST_ASSESSMENT' && allDecided(record)) {
    return 'FIRST_CONDITIONS';
  }
  return record.stage;
}

export const STAGE_NAMES: Record<StageId, string> = {
  OSP_ANALYSIS: 'Analiza opisu stanowiska',
  SHEET_PROPOSAL: 'Wstępny formularz',
  OPENING_TALK: 'Rozmowa rozpoczynająca · część I',
  OBSERVATION: 'Okres oceny · obserwacje',
  ASSESSMENT: 'Rozmowa oceniająca i ocena · część II',
  JUSTIFICATION: 'Uzasadnienie i plan rozwoju (IPRZ)',
  DOCUMENT: 'Dokument i zapoznanie',
  INTRO_TALK: 'Rozmowa wstępna',
  REPORT: 'Sprawozdanie pracownika',
  FIRST_ASSESSMENT: 'Rozmowa oceniająca i ocena',
  FIRST_CONDITIONS: 'Warunki pierwszej oceny',
  FIRST_DOCUMENT: 'Dokument i zapoznanie',
};

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}
