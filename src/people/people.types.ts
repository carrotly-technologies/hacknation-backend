import type {
  CaseStatus,
  Evaluator,
  Path,
  Person,
  StageId,
} from '../cases/case.types.js';

export type AssessmentResult = 'POSITIVE' | 'NEGATIVE';

/** One assessment case kept in the system. */
export interface SystemHistoryEntry {
  source: 'SYSTEM';
  caseId: string;
  path: Path;
  cycleLabel: string;
  status: CaseStatus;
  /** Only once the evaluator signed the assessment; null while in progress. */
  result: AssessmentResult | null;
  /** Overall level (periodic only), e.g. "powyżej oczekiwań"; null otherwise. */
  level: string | null;
  signedByEvaluatorOn: string | null;
  acknowledgedOn: string | null;
}

/**
 * The previous periodic assessment as written on the oldest case's sheet
 * (part II, "Dane dotyczące poprzedniej oceny"): made before the system.
 */
export interface ExternalHistoryEntry {
  source: 'EXTERNAL';
  result: AssessmentResult | null;
  level: string | null;
  date: string | null;
}

export type HistoryItem = SystemHistoryEntry | ExternalHistoryEntry;

export type NextAssessment = 'OKRESOWA' | 'PIERWSZA';

/** The job description (OSP) parts shown on the profile. */
export interface PersonOsp {
  title: string;
  purpose: string;
  mainTasks: string[];
}

/** GET /api/people/:personId. */
export interface PersonProfile {
  person: Person;
  supervisor: Omit<Evaluator, 'id'> | null;
  /** From the current case, else the latest; null when it has no OSP. */
  osp: PersonOsp | null;
  /** Newest first; the external entry (if any) last. */
  history: HistoryItem[];
  currentCase: { id: string; path: Path; currentStage: StageId } | null;
  nextAssessment: NextAssessment;
  /** POST /api/cases would start a new case now (new-case.rules). */
  canStartCase: boolean;
}
