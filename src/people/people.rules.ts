import { computeEvaluation, effectiveStage } from '../cases/case.rules.js';
import type { CaseRecord, Evaluator } from '../cases/case.types.js';
import { caseStatus, cycleLabel } from '../cases/stages.rules.js';
import type {
  ExternalHistoryEntry,
  NextAssessment,
  PersonProfile,
  SystemHistoryEntry,
} from './people.types.js';

/** Date the case's cycle starts from: hiring or the previous assessment. */
function cycleAnchor(record: CaseRecord): string {
  return record.cycleStart.kind === 'HIRED'
    ? record.cycleStart.date
    : record.cycleStart.assessedOn;
}

/** Newest cycle first; the id breaks ties so the order is stable. */
function newestFirst(records: CaseRecord[]): CaseRecord[] {
  return [...records].sort(
    (a, b) =>
      cycleAnchor(b).localeCompare(cycleAnchor(a)) || b.id.localeCompare(a.id),
  );
}

function systemEntry(record: CaseRecord, today: string): SystemHistoryEntry {
  // A result counts only once the evaluator signed the assessment; before
  // that the computed one is a draft and the history shows "in progress".
  const evaluation = record.signedByEvaluatorOn
    ? computeEvaluation(record, today)
    : null;
  return {
    source: 'SYSTEM',
    caseId: record.id,
    path: record.path,
    cycleLabel: cycleLabel(record),
    status: caseStatus(record, today),
    result: evaluation?.result ?? null,
    level: evaluation?.level?.label ?? null,
    signedByEvaluatorOn: record.signedByEvaluatorOn,
    acknowledgedOn: record.acknowledgedOn,
  };
}

/**
 * The next assessment the person needs. An unfinished case decides it (the
 * first assessment of art. 37 ustawy, or a periodic one). Once every case is
 * finished, the periodic assessment comes next (art. 81 ust. 1 ustawy).
 */
export function nextAssessment(
  current: Pick<CaseRecord, 'path'> | null,
): NextAssessment {
  return current?.path === 'FIRST' ? 'PIERWSZA' : 'OKRESOWA';
}

/**
 * The employee profile from the person's cases the caller may see. Null when
 * there are none (unknown person or no access: both a 404 for the caller).
 */
export function buildProfile(
  records: CaseRecord[],
  today: string,
  evaluatorOf: (record: CaseRecord) => Evaluator,
): PersonProfile | null {
  const ordered = newestFirst(records);
  const latest = ordered[0];
  if (!latest) return null;
  const current =
    ordered.find((r) => caseStatus(r, today) !== 'ZAKONCZONA') ?? null;
  // The supervisor is the evaluator of the current case, else of the latest.
  const { id: _id, ...supervisor } = evaluatorOf(current ?? latest);

  // Part II of the oldest case describes the assessment made before the
  // system; later cases' "previous assessment" is already a case here.
  const previous = ordered[ordered.length - 1].previousAssessment;
  const external: ExternalHistoryEntry[] = previous
    ? [{ source: 'EXTERNAL', ...previous }]
    : [];

  return {
    person: latest.person,
    supervisor,
    history: [...ordered.map((r) => systemEntry(r, today)), ...external],
    currentCase: current
      ? {
          id: current.id,
          path: current.path,
          currentStage: effectiveStage(current),
        }
      : null,
    nextAssessment: nextAssessment(current),
  };
}
