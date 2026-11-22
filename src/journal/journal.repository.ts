import type {
  JournalNote,
  JournalObservation,
  ObservationFields,
} from './journal.types.js';

/**
 * Storage of the journal. Every read and write is scoped by author in the
 * query: someone else's entry is simply not found. Lists are newest first
 * (notes by createdAt, observations by date, then createdAt).
 */
export abstract class JournalRepository {
  abstract listNotes(
    personId: string,
    authorId: string,
  ): Promise<JournalNote[]>;
  abstract insertNote(note: JournalNote): Promise<JournalNote>;
  /** null when there is no such note of this author. */
  abstract updateNote(
    id: string,
    authorId: string,
    changes: Pick<JournalNote, 'text' | 'updatedAt'>,
  ): Promise<JournalNote | null>;
  abstract deleteNote(id: string, authorId: string): Promise<boolean>;

  abstract listObservations(
    personId: string,
    authorId: string,
  ): Promise<JournalObservation[]>;
  abstract findObservation(
    id: string,
    authorId: string,
  ): Promise<JournalObservation | null>;
  abstract insertObservation(
    observation: JournalObservation,
  ): Promise<JournalObservation>;
  abstract updateObservation(
    id: string,
    authorId: string,
    changes: Partial<ObservationFields> & { updatedAt: string },
  ): Promise<JournalObservation | null>;
  abstract deleteObservation(id: string, authorId: string): Promise<boolean>;

  /** True when there are no notes and no observations at all. */
  abstract isEmpty(): Promise<boolean>;
  /** Replaces everything with the given entries (demo reset). */
  abstract replaceAll(
    notes: JournalNote[],
    observations: JournalObservation[],
  ): Promise<void>;
  /**
   * Retention (src/retention): deletes notes last changed and observations
   * dated before `cutoff` (YYYY-MM-DD); returns how many were deleted.
   */
  abstract deleteOlderThan(
    cutoff: string,
  ): Promise<{ notes: number; observations: number }>;
}

export function newestNotesFirst(a: JournalNote, b: JournalNote): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

export function newestObservationsFirst(
  a: JournalObservation,
  b: JournalObservation,
): number {
  return (
    b.date.localeCompare(a.date) ||
    b.createdAt.localeCompare(a.createdAt) ||
    b.id.localeCompare(a.id)
  );
}
