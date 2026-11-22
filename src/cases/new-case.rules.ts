import { computeEvaluation } from './case.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord, CycleStart, Path, Person } from './case.types.js';
import { addMonths, formatDatePl } from './dates.js';
import { openingTalkDeadline, USC } from './deadlines.rules.js';
import { caseStatus, nextCycleStart } from './stages.rules.js';
import { caseRecord, previousAssessment } from './seed/seed-helpers.js';

/**
 * How a new case starts: path, cycle anchor and first stage. Derived from the
 * person's latest case (or, without one, from the hiring date):
 * - a finished periodic assessment starts the next periodic cycle (art. 81
 *   ust. 1 ustawy: co 24 miesiące; ust. 9: po negatywnej ponowna ocena),
 * - a positive first assessment is followed by the periodic cycle from the
 *   indefinite contract (art. 38 ust. 3 ustawy, §7 pkt 1 rozp. 2016),
 * - without any case: first assessment when hired less than 12 months ago
 *   (art. 37–38 ustawy), else a periodic cycle from hiring.
 */
export interface NewCasePlan {
  path: Path;
  cycleStart: CycleStart;
}

export function planNewCase(
  person: Person,
  latest: CaseRecord | null,
  today: string,
): NewCasePlan {
  if (!latest) {
    const firstYear = addMonths(person.hiredOn, 12) > today;
    return {
      path: firstYear ? 'FIRST' : 'PERIODIC',
      cycleStart: { kind: 'HIRED', date: person.hiredOn },
    };
  }
  // The new cycle starts once the assessed person acknowledged the previous
  // assessment; a running objection term does not hold it (§7 pkt 1 rozp.
  // 2016 counts from the assessment made in writing).
  const status = caseStatus(latest, today);
  if (status !== 'ZAKONCZONA' && status !== 'OKRES_SPRZECIWU') {
    throw new CaseRuleError(
      'Ten pracownik ma już ocenę w toku. Dokończ ją, zanim rozpoczniesz nową.',
    );
  }
  if (latest.path === 'PERIODIC') {
    const cycleStart = nextCycleStart(latest, today);
    if (!cycleStart) {
      throw new CaseRuleError(
        'Poprzednia ocena nie została podpisana, więc nie można rozpocząć nowego cyklu.',
      );
    }
    return { path: 'PERIODIC', cycleStart };
  }
  const result = computeEvaluation(latest, today)?.result;
  if (result !== 'POSITIVE') {
    throw new CaseRuleError(
      `Po negatywnej pierwszej ocenie nie rozpoczyna się oceny okresowej (art. 38 ust. 3 ${USC}).`,
    );
  }
  return {
    path: 'PERIODIC',
    cycleStart: {
      kind: 'HIRED',
      date: latest.acknowledgedOn ?? latest.signedByEvaluatorOn ?? today,
    },
  };
}

/**
 * The new case record: first stage of the path (OSP analysis or the
 * introductory talk), the person, evaluator and job description carried over
 * from the latest case. Deadlines follow from `cycleStart` (deadlines.rules).
 */
/** Whether a new case may start now (the same checks as planNewCase). */
export function canStartNewCase(
  person: Person,
  latest: CaseRecord | null,
  today: string,
): boolean {
  try {
    planNewCase(person, latest, today);
    return true;
  } catch (error) {
    if (error instanceof CaseRuleError) return false;
    throw error;
  }
}

export function buildNewCase(
  id: string,
  person: Person,
  evaluatorId: string,
  latest: CaseRecord | null,
  today: string,
): CaseRecord {
  const { path, cycleStart } = planNewCase(person, latest, today);
  const level =
    latest && latest.path === 'PERIODIC'
      ? computeEvaluation(latest, today)?.level?.label
      : undefined;
  const previous =
    path === 'PERIODIC' &&
    cycleStart.kind !== 'HIRED' &&
    person.employment === 'URZEDNIK' &&
    level
      ? previousAssessment(cycleStart, level)
      : null;
  const record = caseRecord({
    id,
    person,
    evaluatorId,
    path,
    cycleStart,
    stage: path === 'FIRST' ? 'INTRO_TALK' : 'OSP_ANALYSIS',
    sheetId: path === 'FIRST' ? 'FIRST' : null,
    ospId: path === 'PERIODIC' ? (latest?.ospId ?? null) : null,
    previousAssessment: previous,
    firstConditions:
      path === 'FIRST'
        ? { examPassed: null, reportSubmittedOn: null, reportDue: null }
        : null,
  });
  const opening =
    path === 'PERIODIC' ? openingTalkDeadline(cycleStart).date : null;
  record.history.push({
    date: today,
    text:
      path === 'FIRST'
        ? 'Rozpoczęto pierwszą ocenę'
        : `Rozpoczęto ocenę okresową${opening ? `; rozmowa rozpoczynająca do ${formatDatePl(opening)}` : ''}`,
  });
  return record;
}
