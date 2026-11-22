import { addMonths } from '../cases/dates.js';
import { objectionDeadline } from '../cases/deadlines.rules.js';
import type { CaseRecord } from '../cases/case.types.js';

/**
 * Default retention period, in years. The original sheet goes to the personal
 * file of the assessed person (§ 6 ust. 3 and § 12 ust. 2 rozp. PRM z 4.04.2016,
 * Dz.U. 2016 poz. 470; § 11 ust. 2 rozp. PRM z 23.07.2015, Dz.U. 2015 poz. 1144),
 * and employee documentation is kept for 10 years (art. 94 pkt 9b Kodeksu
 * pracy). The application keeps only a working copy, so it never needs longer.
 * Configurable with RETENTION_YEARS.
 */
export const DEFAULT_RETENTION_YEARS = 10;

export const ANONYMIZED_PERSON_PREFIX = 'anon-';

export const ANONYMIZED_HISTORY_TEXT =
  'Dane osobowe usunięte po upływie okresu przechowywania (retencja, RODO art. 5 ust. 1 lit. e).';

/** RETENTION_YEARS: a whole number of years, 0 or more. */
export function parseRetentionYears(value: string | undefined): number {
  if (value === undefined || value.trim() === '')
    return DEFAULT_RETENTION_YEARS;
  const years = Number(value);
  if (!Number.isInteger(years) || years < 0) {
    throw new Error(
      `RETENTION_YEARS must be a whole number of years, 0 or more (got "${value}").`,
    );
  }
  return years;
}

/** Data finished before this day (YYYY-MM-DD) is past retention. */
export function retentionCutoff(today: string, years: number): string {
  return addMonths(today, -12 * years);
}

/**
 * Day the case ended, or null while it is still running: a periodic
 * assessment ends with the objection term (art. 83 ust. 1 ustawy), a first
 * assessment when the person acknowledged it.
 */
export function caseEndedOn(record: CaseRecord): string | null {
  if (!record.acknowledgedOn) return null;
  return record.path === 'PERIODIC'
    ? (objectionDeadline(record.acknowledgedOn).date ?? record.acknowledgedOn)
    : record.acknowledgedOn;
}

export function isAnonymized(record: CaseRecord): boolean {
  return record.person.id.startsWith(ANONYMIZED_PERSON_PREFIX);
}

/** Ended before the cutoff and not anonymized yet. */
export function isPastRetention(record: CaseRecord, cutoff: string): boolean {
  const endedOn = caseEndedOn(record);
  return endedOn !== null && endedOn < cutoff && !isAnonymized(record);
}

/**
 * The case without data that identifies the person or describes them in
 * free text. Kept: scores, the result, the sheet, the procedure dates and the
 * evaluator, so statistics and deadline rules keep working. The person gets
 * a new id, so the case no longer joins their profile.
 */
export function anonymizeCase(record: CaseRecord, today: string): CaseRecord {
  return {
    ...record,
    person: {
      ...record.person,
      id: `${ANONYMIZED_PERSON_PREFIX}${record.id}`,
      firstName: 'Osoba',
      lastName: 'zanonimizowana',
      position: '',
      unit: '',
    },
    partI: {
      ...record.partI,
      topics: { duties: '', criteria: '', expectations: '', goals: '' },
      expectations: {},
    },
    observations: [],
    deviationNotes: {},
    justification: '',
    iprz: '',
    promotionRequest: { ...record.promotionRequest, motivation: '' },
    objection: record.objection ? { ...record.objection, text: '' } : null,
    ackToken: null,
    ackTokenExpiresOn: null,
    history: [{ date: today, text: ANONYMIZED_HISTORY_TEXT }],
  };
}
