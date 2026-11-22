import { Injectable, NotFoundException } from '@nestjs/common';
import { fullName } from '../cases/case.rules.js';
import type { CaseSummary } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { formatDatePl } from '../cases/dates.js';
import { describeDaysLeft } from '../cases/deadlines.rules.js';

export interface HrCase extends CaseSummary {
  evaluatorName: string;
  lastReminderOn: string | null;
  /** Date the assessed person filed an objection ("Sprzeciw"), else null. */
  objectionSubmittedOn: string | null;
}

@Injectable()
export class HrService {
  constructor(private readonly cases: CasesService) {}

  overview() {
    const cases: HrCase[] = this.cases.all().map((record) => ({
      ...this.cases.summary(record),
      evaluatorName: this.cases.evaluatorName(record),
      lastReminderOn: record.lastReminderOn,
      objectionSubmittedOn: record.objection?.submittedOn ?? null,
    }));
    const count = (pred: (c: HrCase) => boolean) => cases.filter(pred).length;
    return {
      counters: {
        inProgress: count((c) => c.status === 'W_TOKU'),
        dueSoon: count((c) => c.nextDeadline?.state === 'SOON'),
        overdue: count((c) => c.nextDeadline?.state === 'OVERDUE'),
        awaitingAck: count((c) => c.status === 'DO_ZAPOZNANIA'),
        objectionPeriod: count((c) => c.status === 'OKRES_SPRZECIWU'),
      },
      cases,
    };
  }

  /** Simulated: nothing is sent, the reminder is logged in the case history. */
  remind(caseIds: string[]) {
    const unknown = caseIds.filter((id) => {
      try {
        this.cases.record(id);
        return false;
      } catch {
        return true;
      }
    });
    if (unknown.length > 0) {
      throw new NotFoundException(
        `Nie znaleziono teczek oceny: ${unknown.map((id) => `„${id}”`).join(', ')}.`,
      );
    }
    const today = this.cases.today;
    const log = [...new Set(caseIds)].map((caseId) => {
      const record = this.cases.record(caseId);
      const summary = this.cases.summary(record);
      const deadline = summary.nextDeadline;
      const what = deadline?.date
        ? `${deadline.label} ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft!)})`
        : `etap „${summary.stages.find((s) => s.id === summary.currentStage)?.name}”`;
      const text = `Przypomnienie (symulacja) do: ${this.cases.evaluatorName(record)}. Ocena: ${fullName(record.person)}, ${what}.`;
      this.cases.save({
        ...record,
        lastReminderOn: today,
        history: [...record.history, { date: today, text }],
      });
      return { caseId, date: today, text };
    });
    return { sent: log.length, log };
  }
}
