import { analyseOsp } from '../osp/osp-analysis.rules.js';
import { findOsp, toOspDoc } from '../osp/osp.data.js';
import { ackLinkOf } from './ack-link.rules.js';
import { availableActions } from './actions.rules.js';
import { assessmentTalkTopics } from './assessment-talk.rules.js';
import { computeEvaluation, effectiveStage } from './case.rules.js';
import type {
  CaseAction,
  CaseDetail,
  CaseRecord,
  CaseSummary,
  Evaluator,
} from './case.types.js';
import { formalCheck } from './formal-check.rules.js';
import { promotionRequestOf } from './promotion.rules.js';
import {
  buildStages,
  caseStatus,
  cycleLabel,
  nextDeadline,
  objectionDeadlineOf,
} from './stages.rules.js';

export function toSummary(record: CaseRecord, today: string): CaseSummary {
  return {
    id: record.id,
    person: record.person,
    path: record.path,
    sheetId: record.sheetId,
    cycleLabel: cycleLabel(record),
    currentStage: effectiveStage(record),
    stages: buildStages(record, today),
    nextDeadline: nextDeadline(record, today),
    status: caseStatus(record, today),
  };
}

export function toDetail(
  record: CaseRecord,
  today: string,
  evaluator: Evaluator,
  officeName: string,
  { withAckLink = false }: { withAckLink?: boolean } = {},
): CaseDetail & { availableActions: CaseAction[] } {
  const ackLink = withAckLink ? ackLinkOf(record) : null;
  const osp = findOsp(record.ospId);
  const { id: _id, ...evaluatorView } = evaluator;
  return {
    ...toSummary(record, today),
    evaluator: evaluatorView,
    officeName,
    osp: osp ? toOspDoc(osp) : null,
    ospAnalysis: osp && record.path === 'PERIODIC' ? analyseOsp(osp) : null,
    partI: record.partI,
    observations: record.observations,
    ratings: record.ratings,
    decisions: record.decisions,
    deviationNotes: record.deviationNotes,
    justification: record.justification,
    iprz: record.iprz,
    previousAssessment: record.previousAssessment,
    promotionRequest: promotionRequestOf(record),
    firstConditions: record.firstConditions,
    assessmentTalkOn: record.assessmentTalkOn,
    assessmentTalkTopics: assessmentTalkTopics(record),
    evaluation: computeEvaluation(record, today),
    formalCheck: formalCheck(record, today),
    signedByEvaluatorOn: record.signedByEvaluatorOn,
    sentForAckOn: record.sentForAckOn,
    ackLink,
    ackLinkExpiresOn: ackLink ? record.ackTokenExpiresOn : null,
    acknowledgedOn: record.acknowledgedOn,
    objectionDeadline: objectionDeadlineOf(record, today),
    objection: record.objection,
    history: record.history,
    availableActions: availableActions(record, today),
  };
}
