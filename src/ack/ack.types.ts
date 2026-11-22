import type { EvaluateResult } from '../assessments/evaluate.rules.js';
import type {
  CaseDetail,
  Deadline,
  Objection,
  StageId,
} from '../cases/case.types.js';
import type { ScaleLevel } from '../competency-model/competency-model.types.js';
import type { Sheet } from '../sheets/sheet.types.js';

/**
 * What the assessed person sees through the link: only what the read-only
 * sheet prints (no ids, observations, indicator ratings, OSP or history).
 */
export interface AckSheetData {
  path: CaseDetail['path'];
  sheetId: CaseDetail['sheetId'];
  officeName: string;
  person: Omit<CaseDetail['person'], 'id'>;
  evaluator: CaseDetail['evaluator'];
  stages: { id: StageId; completedOn: string | null }[];
  partI: Pick<
    CaseDetail['partI'],
    | 'additionalCriteria'
    | 'assessmentDue'
    | 'confirmedByEvaluatorOn'
    | 'acknowledgedByEmployeeOn'
  >;
  decisions: Record<string, number>;
  evaluation: EvaluateResult | null;
  justification: string;
  iprz: string;
  previousAssessment: CaseDetail['previousAssessment'];
  promotionRequest: CaseDetail['promotionRequest'];
  firstConditions: CaseDetail['firstConditions'];
  assessmentTalkOn: string | null;
  signedByEvaluatorOn: string | null;
  acknowledgedOn: null;
}

/** GET /api/ack/:token before the confirmation. */
export interface AckPending {
  acknowledgedOn: null;
  expiresOn: string;
  case: AckSheetData;
  /** The case's sheet template (wording, criteria, scale points). */
  sheet: Sheet | null;
  /** Labels of the scale points, from the competency model. */
  scale: ScaleLevel[];
  /** Names of the criteria assessed in this case. */
  competencies: { id: string; name: string }[];
}

/**
 * GET after the confirmation, and the response of both POSTs. The link keeps
 * working after the objection term too, then with `objectionOpen: false`.
 */
export interface AckDone {
  acknowledgedOn: string;
  /** Only for a periodic assessment (art. 83 ust. 1 ustawy). */
  objectionDeadline: Deadline | null;
  /** The objection once filed (read-only), else null. */
  objection: Objection | null;
  /** True while an objection can still be filed (periodic, none yet, in the term). */
  objectionOpen: boolean;
}
