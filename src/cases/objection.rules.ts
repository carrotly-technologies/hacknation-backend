import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import { formatDatePl } from './dates.js';
import { objectionDeadline, USC } from './deadlines.rules.js';

/**
 * Objection of the assessed person (art. 83 ust. 1 ustawy): "od oceny
 * okresowej przysługuje sprzeciw do dyrektora generalnego urzędu w terminie
 * 7 dni od dnia zapoznania się z oceną". The app only records it; how the
 * director general handles it (art. 83 ust. 2–4) is out of scope.
 */

/** Product limit of the text (not a legal one), like other free-text fields. */
export const OBJECTION_MAX_LENGTH = 4000;

/** Last day of the objection term, or null when none runs (first assessment, not acknowledged). */
export function objectionLastDay(record: CaseRecord): string | null {
  if (record.path !== 'PERIODIC' || !record.acknowledgedOn) return null;
  return objectionDeadline(record.acknowledgedOn).date;
}

/** True while the assessed person may still file the (single) objection. */
export function objectionOpen(record: CaseRecord, today: string): boolean {
  const lastDay = objectionLastDay(record);
  return !!lastDay && !record.objection && today <= lastDay;
}

/**
 * Records the objection. Throws CaseRuleError (409) before the
 * acknowledgement, for a first assessment, after the term or a second time.
 */
export function submitObjection(
  record: CaseRecord,
  text: string,
  today: string,
): CaseRecord {
  if (!record.acknowledgedOn) {
    throw new CaseRuleError(
      'Najpierw potwierdź zapoznanie z oceną. Potwierdzenie nie oznacza zgody z oceną.',
    );
  }
  const lastDay = objectionLastDay(record);
  if (!lastDay) {
    throw new CaseRuleError(
      `Sprzeciw przysługuje tylko od oceny okresowej (art. 83 ust. 1 ${USC}).`,
    );
  }
  if (record.objection) {
    throw new CaseRuleError(
      `Zastrzeżenia zostały już przekazane ${formatDatePl(record.objection.submittedOn)}. Nie można ich zmienić ani wysłać ponownie.`,
    );
  }
  if (today > lastDay) {
    throw new CaseRuleError(
      `Termin na sprzeciw minął ${formatDatePl(lastDay)} (art. 83 ust. 1 ${USC}: 7 dni od dnia zapoznania się z oceną).`,
    );
  }
  return {
    ...record,
    objection: { text, submittedOn: today },
    history: [
      ...record.history,
      {
        date: today,
        text: `Oceniany wniósł sprzeciw od oceny ${formatDatePl(today)}.`,
      },
    ],
  };
}
