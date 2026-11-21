import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ackTokenExpired, ackTokenMatches } from '../cases/ack-link.rules.js';
import { applyAction } from '../cases/actions.rules.js';
import { CaseRuleError } from '../cases/case-rule.error.js';
import type { CaseRecord } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { CompetencyModelService } from '../competency-model/competency-model.service.js';
import { SheetsService } from '../sheets/sheets.service.js';
import type { AckDone, AckPending } from './ack.types.js';

const INVALID_LINK =
  'Link jest nieważny albo wygasł. Poproś przełożonego o nowy link.';

/** The public page of the assessed person (no sign-in; the token is the key). */
@Injectable()
export class AckService {
  constructor(
    private readonly cases: CasesService,
    private readonly sheets: SheetsService,
    private readonly model: CompetencyModelService,
  ) {}

  read(token: string): AckPending | AckDone {
    const record = this.find(token);
    if (record.acknowledgedOn) return this.done(record);

    const detail = this.cases.detail(record.id);
    const sheet =
      this.sheets.findById(
        detail.path === 'FIRST' ? 'FIRST' : (detail.sheetId ?? ''),
      ) ?? null;
    const criteria = [
      ...(sheet?.mandatoryCriteria ?? []),
      ...(detail.path === 'FIRST' ? [] : detail.partI.additionalCriteria),
    ];
    const { id: _id, ...person } = detail.person;
    return {
      acknowledgedOn: null,
      expiresOn: record.ackTokenExpiresOn!,
      case: {
        path: detail.path,
        sheetId: detail.sheetId,
        officeName: detail.officeName,
        person,
        evaluator: detail.evaluator,
        stages: detail.stages.map((s) => ({
          id: s.id,
          completedOn: s.completedOn,
        })),
        partI: {
          additionalCriteria: detail.partI.additionalCriteria,
          assessmentDue: detail.partI.assessmentDue,
          confirmedByEvaluatorOn: detail.partI.confirmedByEvaluatorOn,
          acknowledgedByEmployeeOn: detail.partI.acknowledgedByEmployeeOn,
        },
        decisions: detail.decisions,
        evaluation: detail.evaluation,
        justification: detail.justification,
        iprz: detail.iprz,
        previousAssessment: detail.previousAssessment,
        promotionRequest: detail.promotionRequest,
        firstConditions: detail.firstConditions,
        assessmentTalkOn: detail.assessmentTalkOn,
        signedByEvaluatorOn: detail.signedByEvaluatorOn,
        acknowledgedOn: null,
      },
      sheet,
      scale: this.model.getModel().scale,
      competencies: criteria.map((id) => ({
        id,
        name: this.model.findCompetency(id)?.name ?? id,
      })),
    };
  }

  /** EMPLOYEE_ACK_ASSESSMENT; a repeated confirmation returns the first date. */
  confirm(token: string): AckDone {
    const record = this.find(token);
    if (record.acknowledgedOn) return this.done(record);
    let next: CaseRecord;
    try {
      next = applyAction(record, 'EMPLOYEE_ACK_ASSESSMENT', this.cases.today);
    } catch (error) {
      if (error instanceof CaseRuleError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    this.cases.save(next);
    return this.done(next);
  }

  /**
   * The case whose current token matches. After the confirmation the token
   * still opens the "potwierdzono" message (but nothing else), even when the
   * 14 days have passed; a replaced or expired token is unknown.
   */
  private find(token: string): CaseRecord {
    const record = this.cases
      .all()
      .find((r) => ackTokenMatches(r.ackToken, token));
    if (
      !record ||
      (!record.acknowledgedOn && ackTokenExpired(record, this.cases.today))
    ) {
      throw new NotFoundException(INVALID_LINK);
    }
    return record;
  }

  private done(record: CaseRecord): AckDone {
    return {
      acknowledgedOn: record.acknowledgedOn!,
      objectionDeadline: this.cases.detail(record.id).objectionDeadline,
    };
  }
}
