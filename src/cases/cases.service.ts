import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import { CasePolicy } from '../auth/case.policy.js';
import type { User } from '../auth/user.types.js';
import { type ActionInput, applyAction } from './actions.rules.js';
import { fullName } from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import { CaseStore } from './case-store.service.js';
import type {
  CaseAction,
  CaseDetail,
  CaseRecord,
  CaseSummary,
  Deadline,
  StageId,
} from './case.types.js';
import { toDetail, toSummary } from './case-view.js';
import type { ObservationInput, PatchCase } from './cases.schemas.js';
import { formatDatePl } from './dates.js';
import { describeDaysLeft } from './deadlines.rules.js';
import { addObservation, applyPatch } from './patch.rules.js';
import { OFFICE_NAME } from './seed/seed.data.js';

export interface TodoItem {
  caseId: string;
  stageId: StageId;
  text: string;
  deadline: Deadline;
}

const TODO_TEXT: Partial<Record<StageId, string>> = {
  OSP_ANALYSIS: 'przeanalizuj opis stanowiska',
  SHEET_PROPOSAL: 'zaakceptuj proponowany formularz oceny',
  OPENING_TALK: 'przeprowadź rozmowę rozpoczynającą (część I)',
  OBSERVATION: 'przejdź do formularza oceny kompetencji',
  ASSESSMENT: 'wypełnij formularz oceny kompetencji',
  ASSESSMENT_TALK: 'przeprowadź rozmowę oceniającą i odnotuj jej datę',
  JUSTIFICATION:
    'zweryfikuj formularz po rozmowie oceniającej, uzupełnij IPRZ i podpisz ocenę',
  INTRO_TALK: 'przeprowadź rozmowę wstępną i wyznacz termin sprawozdania',
  REPORT: 'odbierz sprawozdanie pracownika',
  FIRST_ASSESSMENT: 'wypełnij formularz pierwszej oceny',
  FIRST_CONDITIONS: 'uzupełnij warunki pierwszej oceny i zatwierdź ocenę',
};

@Injectable()
export class CasesService {
  constructor(
    private readonly store: CaseStore,
    private readonly auth: AuthenticationContext,
    private readonly authorization: AuthorizationService,
  ) {}

  get today(): string {
    return this.store.today;
  }

  /** The signed-in user, for GET /api/me. */
  me() {
    const user = this.auth.requireUser();
    return {
      id: user.id,
      login: user.login,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      position: user.position,
      unit: user.unit,
      officeName: OFFICE_NAME,
    };
  }

  /** Cases the caller may see: a supervisor's own, every case for HR. */
  visibleCases(): CaseSummary[] {
    const user = this.auth.requireUser();
    return this.store
      .all()
      .filter((r) => user.role === 'HR' || isEvaluator(user, r))
      .map((r) => toSummary(r, this.today));
  }

  team(): { cases: CaseSummary[]; todo: TodoItem[] } {
    const user = this.auth.requireUser();
    const records = this.store.all().filter((c) => isEvaluator(user, c));
    const cases = records.map((r) => toSummary(r, this.today));
    const todo = cases
      .flatMap((c): TodoItem[] => {
        const deadline = c.nextDeadline;
        if (!deadline?.date) return [];
        const name = fullName(c.person);
        let text: string;
        if (c.status === 'OKRES_SPRZECIWU') {
          text = `${name}: biegnie termin na sprzeciw od oceny`;
        } else if (c.status === 'ZAKONCZONA') {
          text = `${name}: przeprowadź rozmowę rozpoczynającą nowego cyklu`;
        } else {
          const action = TODO_TEXT[c.currentStage];
          if (!action) return [];
          text = `${name}: ${action}`;
        }
        text += ` do ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft!)}) · ${deadline.legalBasis.split(/[:;(]/)[0].trim()}`;
        return [{ caseId: c.id, stageId: c.currentStage, text, deadline }];
      })
      .sort((a, b) => a.deadline.date!.localeCompare(b.deadline.date!));
    return { cases, todo };
  }

  all(): CaseRecord[] {
    return this.store.all();
  }

  summary(record: CaseRecord): CaseSummary {
    return toSummary(record, this.today);
  }

  /** GET /api/cases/:id: 404 for an unknown case, 403 for someone else's. */
  async view(id: string): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('view', record);
    // The link for the assessed person only for the case's evaluator, never HR.
    return this.detail(id, isEvaluator(this.auth.requireUser(), record));
  }

  async patch(id: string, patch: PatchCase): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('edit', record);
    this.store.save(this.run(() => applyPatch(record, patch, this.today)));
    return this.detail(id, true);
  }

  async addObservation(
    id: string,
    input: ObservationInput,
  ): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('edit', record);
    const next = this.run(() =>
      addObservation(
        record,
        input,
        this.store.nextObservationId(id),
        this.today,
      ),
    );
    this.store.save(next);
    return this.detail(id, true);
  }

  async action(
    id: string,
    action: CaseAction,
    input: ActionInput = {},
  ): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('edit', record);
    this.store.save(
      this.run(() => applyAction(record, action, this.today, input)),
    );
    return this.detail(id, true);
  }

  private authorize(ability: 'view' | 'edit', record: CaseRecord) {
    return this.authorization.authorize(
      CasePolicy,
      ability,
      this.auth.requireUser(),
      record,
    );
  }

  /**
   * Unscoped: for internal use. Routes go through view(). `withAckLink` only
   * for the case's evaluator (the link is the assessed person's key).
   */
  detail(id: string, withAckLink = false): CaseDetail {
    const record = this.record(id);
    return toDetail(
      record,
      this.today,
      this.store.evaluator(record.evaluatorId),
      OFFICE_NAME,
      { withAckLink },
    );
  }

  reset(): void {
    this.store.reset();
  }

  record(id: string): CaseRecord {
    const record = this.store.find(id);
    if (!record)
      throw new NotFoundException(`Nie znaleziono teczki oceny „${id}”.`);
    return record;
  }

  save(record: CaseRecord): void {
    this.store.save(record);
  }

  evaluatorName(record: CaseRecord): string {
    return fullName(this.store.evaluator(record.evaluatorId));
  }

  /** Domain errors -> HTTP: 409 for rules and locks, 400 for bad values. */
  private run<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CaseRuleError) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: error.message,
          ...(error.formalCheck ? { formalCheck: error.formalCheck } : {}),
        });
      }
      if (error instanceof CaseValidationError) {
        throw new BadRequestException(error.messages);
      }
      throw error;
    }
  }
}

function isEvaluator(user: User, record: CaseRecord): boolean {
  return !!user.evaluatorId && record.evaluatorId === user.evaluatorId;
}
