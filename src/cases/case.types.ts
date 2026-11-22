import type { EvaluateResult } from '../assessments/evaluate.rules.js';
import type { SheetId } from '../sheets/sheet.types.js';

/** Types of contract v2 (notatki/api-kontrakt-v2.md). */

export type Path = 'PERIODIC' | 'FIRST';

export const PERIODIC_STAGES = [
  'OSP_ANALYSIS',
  // "Wstępny formularz": the evaluator reviews the proposed sheet and its
  // criteria before the opening talk.
  'SHEET_PROPOSAL',
  'OPENING_TALK',
  'OBSERVATION',
  'ASSESSMENT',
  // Etap III Poradnika (Tabela nr 1): rozmowa oceniająca, §10 rozp. 2016.
  'ASSESSMENT_TALK',
  // Etap IV: sporządzenie oceny na piśmie po rozmowie, §11 rozp. 2016.
  'JUSTIFICATION',
  'DOCUMENT',
] as const;
export const FIRST_STAGES = [
  'INTRO_TALK',
  'REPORT',
  'FIRST_ASSESSMENT',
  'FIRST_CONDITIONS',
  'FIRST_DOCUMENT',
] as const;
export type PeriodicStageId = (typeof PERIODIC_STAGES)[number];
export type FirstStageId = (typeof FIRST_STAGES)[number];
export type StageId = PeriodicStageId | FirstStageId;

export type StageStatus = 'DONE' | 'CURRENT' | 'UPCOMING' | 'LOCKED';
export type DeadlineState = 'OK' | 'SOON' | 'OVERDUE' | 'NONE';
export type CaseStatus =
  'W_TOKU' | 'DO_ZAPOZNANIA' | 'OKRES_SPRZECIWU' | 'ZAKONCZONA';

export type Employment = 'URZEDNIK' | 'PRACOWNIK';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  unit: string;
  employment: Employment;
  hiredOn: string;
}

export interface Evaluator {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  unit: string;
}

export interface Deadline {
  date: string | null;
  daysLeft: number | null;
  state: DeadlineState;
  label: string;
  legalBasis: string;
}

export interface StageInfo {
  id: StageId;
  name: string;
  status: StageStatus;
  deadline: Deadline | null;
  completedOn: string | null;
  legalBasis: string;
}

export interface CaseSummary {
  id: string;
  person: Person;
  path: Path;
  sheetId: SheetId | null;
  cycleLabel: string;
  currentStage: StageId;
  stages: StageInfo[];
  nextDeadline: Deadline | null;
  status: CaseStatus;
}

export type ObservationKind = 'STRENGTH' | 'DEVELOPMENT';

export interface Observation {
  id: string;
  date: string;
  criterionId: string;
  indicatorId: string | null;
  kind: ObservationKind;
  situation: string;
  action: string;
  result: string;
}

export interface OspDoc {
  id: string;
  title: string;
  purpose: string;
  subordinates: string;
  mainTasks: string[];
  softCompetencies: string[];
  otherRequirements: string[];
  source: string;
}

export interface OspAnalysis {
  suggestedSheet: {
    sheetId: SheetId;
    reason: string;
    legalBasis: string;
  } | null;
  additionalCandidates: {
    criterionId: string;
    reason: string;
    ospQuote: string;
  }[];
}

export interface PartITopics {
  duties: string;
  criteria: string;
  expectations: string;
  goals: string;
}

export interface PartI {
  additionalCriteria: string[];
  assessmentDue: string | null;
  topics: PartITopics;
  expectations: Record<string, string>;
  confirmedByEvaluatorOn: string | null;
  acknowledgedByEmployeeOn: string | null;
}

export type RatingPoints = 1 | 3 | 5 | 7 | 9;
export type Ratings = Record<string, Record<string, RatingPoints | null>>;

export type ExamPassed = 'YES' | 'NO' | 'NOT_APPLICABLE';

export interface FirstConditions {
  examPassed: ExamPassed | null;
  reportSubmittedOn: string | null;
  reportDue: string | null;
}

/**
 * "Dane dotyczące poprzedniej oceny okresowej urzędnika służby cywilnej"
 * (part II of sheets A, B, C). `level` is the overall level as written on the
 * sheet, e.g. "na poziomie oczekiwań" (footnote 14/15 of the template).
 */
export interface PreviousAssessment {
  result: 'POSITIVE' | 'NEGATIVE' | null;
  level: string | null;
  date: string | null;
}

/** Answer to "Czy do oceny okresowej dołączono wniosek o przyznanie kolejnego stopnia służbowego?". */
export type PromotionAttached = 'YES' | 'NO' | 'NOT_APPLICABLE';

/**
 * The answer above and part III of the sheet (the request of art. 89 ust. 1
 * ustawy). Part III fields are kept only while `attached` is YES.
 */
export interface PromotionRequest {
  attached: PromotionAttached | null;
  appointedYear: number | null;
  currentGrade: string | null;
  gradeGrantedOn: string | null;
  requestedGrade: string | null;
  motivation: string;
}

export interface FormalCheckItem {
  id: string;
  ok: boolean;
  message: string;
  legalBasis: string | null;
}

/** One of the topics of the assessment talk (§10 pkt 1–3 rozp. 2016). */
export interface AssessmentTalkTopic {
  id: 'DUTIES' | 'GOALS' | 'DEVELOPMENT';
  /** Short wording for the checklist. */
  label: string;
  /** The point of §10 word for word. */
  quote: string;
  legalBasis: string;
}

/** The assessed person's objection (art. 83 ust. 1 ustawy), recorded through the ack link. */
export interface Objection {
  text: string;
  submittedOn: string;
}

export interface HistoryEntry {
  date: string;
  text: string;
}

export interface CaseDetail extends CaseSummary {
  evaluator: Omit<Evaluator, 'id'>;
  officeName: string;
  osp: OspDoc | null;
  ospAnalysis: OspAnalysis | null;
  partI: PartI;
  observations: Observation[];
  ratings: Ratings;
  decisions: Record<string, number>;
  deviationNotes: Record<string, string>;
  justification: string;
  iprz: string;
  previousAssessment: PreviousAssessment | null;
  promotionRequest: PromotionRequest;
  firstConditions: FirstConditions | null;
  /** Date of the assessment talk (§10 rozp. 2016); null until recorded. */
  assessmentTalkOn: string | null;
  /** What the assessment talk covers (§10); empty for the first assessment. */
  assessmentTalkTopics: AssessmentTalkTopic[];
  evaluation: EvaluateResult | null;
  formalCheck: FormalCheckItem[];
  signedByEvaluatorOn: string | null;
  sentForAckOn: string | null;
  /**
   * "/zapoznanie/{token}" for the case's evaluator while the assessed person
   * has not confirmed yet; null for HR and everyone else. The token itself is
   * never part of the case view.
   */
  ackLink: string | null;
  ackLinkExpiresOn: string | null;
  acknowledgedOn: string | null;
  objectionDeadline: Deadline | null;
  /** Filed once through the ack link, within the objection term. */
  objection: Objection | null;
  history: HistoryEntry[];
}

/**
 * How the current cycle started; the anchor of the opening-talk deadline (§7
 * rozp. 2016) and, after a negative assessment, of the re-assessment date
 * (art. 81 ust. 9 ustawy).
 */
export type CycleStart =
  | { kind: 'HIRED'; date: string }
  | { kind: 'PREVIOUS_POSITIVE'; assessedOn: string }
  | { kind: 'PREVIOUS_NEGATIVE'; assessedOn: string; acknowledgedOn: string };

/**
 * Stored stages. ASSESSMENT also covers ASSESSMENT_TALK and JUSTIFICATION,
 * and FIRST_ASSESSMENT covers FIRST_CONDITIONS: which one is current is
 * derived from whether every criterion has a decision and whether the
 * assessment talk was recorded (`effectiveStage`).
 */
export type StoredStage = Exclude<
  StageId,
  'ASSESSMENT_TALK' | 'JUSTIFICATION' | 'FIRST_CONDITIONS'
>;

/** What the in-memory store keeps; everything else is derived on read. */
export interface CaseRecord {
  id: string;
  person: Person;
  evaluatorId: string;
  path: Path;
  sheetId: SheetId | null;
  ospId: string | null;
  cycleStart: CycleStart;
  stage: StoredStage;
  completedOn: Partial<Record<StageId, string>>;
  partI: PartI;
  observations: Observation[];
  ratings: Ratings;
  decisions: Record<string, number>;
  deviationNotes: Record<string, string>;
  justification: string;
  iprz: string;
  previousAssessment: PreviousAssessment | null;
  promotionRequest: PromotionRequest;
  firstConditions: FirstConditions | null;
  /** Set by RECORD_ASSESSMENT_TALK. */
  assessmentTalkOn: string | null;
  signedByEvaluatorOn: string | null;
  sentForAckOn: string | null;
  /** Secret of the link for the assessed person (ack-link.rules.ts). */
  ackToken: string | null;
  ackTokenExpiresOn: string | null;
  acknowledgedOn: string | null;
  /** Set by POST /api/ack/:token/objection (objection.rules.ts). */
  objection: Objection | null;
  history: HistoryEntry[];
  lastReminderOn: string | null;
}

export type CaseAction =
  | 'ACCEPT_OSP_ANALYSIS'
  | 'ACCEPT_SHEET'
  | 'CONFIRM_PART_I'
  | 'EMPLOYEE_ACK_PART_I'
  | 'START_ASSESSMENT'
  | 'RECORD_ASSESSMENT_TALK'
  | 'SIGN_ASSESSMENT'
  | 'SEND_FOR_ACK'
  | 'EMPLOYEE_ACK_ASSESSMENT'
  | 'REPORT_SUBMITTED'
  | 'COMPLETE_INTRO_TALK';

export const CASE_ACTIONS: readonly CaseAction[] = [
  'ACCEPT_OSP_ANALYSIS',
  'ACCEPT_SHEET',
  'CONFIRM_PART_I',
  'EMPLOYEE_ACK_PART_I',
  'START_ASSESSMENT',
  'RECORD_ASSESSMENT_TALK',
  'SIGN_ASSESSMENT',
  'SEND_FOR_ACK',
  'EMPLOYEE_ACK_ASSESSMENT',
  'REPORT_SUBMITTED',
  'COMPLETE_INTRO_TALK',
];
