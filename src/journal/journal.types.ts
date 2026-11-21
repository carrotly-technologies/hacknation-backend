import type { ObservationKind } from '../cases/case.types.js';

/**
 * A supervisor's private note about an employee (`Person`), kept all year,
 * independent of the case stage. Visible to its author only.
 */
export interface JournalNote {
  id: string;
  personId: string;
  authorId: string;
  text: string;
  /** ISO 8601 timestamps (UTC). */
  createdAt: string;
  updatedAt: string;
}

/** An S-D-R observation about an employee, same fields as a case observation. */
export interface JournalObservation {
  id: string;
  personId: string;
  authorId: string;
  /** YYYY-MM-DD, the day the situation happened. */
  date: string;
  criterionId: string;
  indicatorId: string | null;
  kind: ObservationKind;
  situation: string;
  action: string;
  result: string;
  createdAt: string;
  updatedAt: string;
}

export type ObservationFields = Pick<
  JournalObservation,
  | 'date'
  | 'criterionId'
  | 'indicatorId'
  | 'kind'
  | 'situation'
  | 'action'
  | 'result'
>;
