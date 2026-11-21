import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import { JournalRepository } from './journal.repository.js';
import { journalNotes, journalObservations } from './journal.tables.js';
import type {
  JournalNote,
  JournalObservation,
  ObservationFields,
} from './journal.types.js';

type NoteRow = typeof journalNotes.$inferSelect;
type ObservationRow = typeof journalObservations.$inferSelect;

const toNote = (row: NoteRow): JournalNote => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toObservation = (row: ObservationRow): JournalObservation => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const noteRow = (n: JournalNote) => ({
  ...n,
  createdAt: new Date(n.createdAt),
  updatedAt: new Date(n.updatedAt),
});

const observationRow = (o: JournalObservation) => ({
  ...o,
  createdAt: new Date(o.createdAt),
  updatedAt: new Date(o.updatedAt),
});

/** Used with DATABASE_URL: tables journal_notes and journal_observations. */
export class PostgresJournalRepository extends JournalRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async listNotes(personId: string, authorId: string) {
    const rows = await this.db
      .select()
      .from(journalNotes)
      .where(
        and(
          eq(journalNotes.personId, personId),
          eq(journalNotes.authorId, authorId),
        ),
      )
      .orderBy(desc(journalNotes.createdAt), desc(journalNotes.id));
    return rows.map(toNote);
  }

  async insertNote(note: JournalNote) {
    const [row] = await this.db
      .insert(journalNotes)
      .values(noteRow(note))
      .returning();
    return toNote(row);
  }

  async updateNote(
    id: string,
    authorId: string,
    changes: Pick<JournalNote, 'text' | 'updatedAt'>,
  ) {
    const [row] = await this.db
      .update(journalNotes)
      .set({ text: changes.text, updatedAt: new Date(changes.updatedAt) })
      .where(and(eq(journalNotes.id, id), eq(journalNotes.authorId, authorId)))
      .returning();
    return row ? toNote(row) : null;
  }

  async deleteNote(id: string, authorId: string) {
    const rows = await this.db
      .delete(journalNotes)
      .where(and(eq(journalNotes.id, id), eq(journalNotes.authorId, authorId)))
      .returning({ id: journalNotes.id });
    return rows.length > 0;
  }

  async listObservations(personId: string, authorId: string) {
    const rows = await this.db
      .select()
      .from(journalObservations)
      .where(
        and(
          eq(journalObservations.personId, personId),
          eq(journalObservations.authorId, authorId),
        ),
      )
      .orderBy(
        desc(journalObservations.date),
        desc(journalObservations.createdAt),
        desc(journalObservations.id),
      );
    return rows.map(toObservation);
  }

  async findObservation(id: string, authorId: string) {
    const [row] = await this.db
      .select()
      .from(journalObservations)
      .where(
        and(
          eq(journalObservations.id, id),
          eq(journalObservations.authorId, authorId),
        ),
      );
    return row ? toObservation(row) : null;
  }

  async insertObservation(observation: JournalObservation) {
    const [row] = await this.db
      .insert(journalObservations)
      .values(observationRow(observation))
      .returning();
    return toObservation(row);
  }

  async updateObservation(
    id: string,
    authorId: string,
    changes: Partial<ObservationFields> & { updatedAt: string },
  ) {
    const [row] = await this.db
      .update(journalObservations)
      .set({ ...changes, updatedAt: new Date(changes.updatedAt) })
      .where(
        and(
          eq(journalObservations.id, id),
          eq(journalObservations.authorId, authorId),
        ),
      )
      .returning();
    return row ? toObservation(row) : null;
  }

  async deleteObservation(id: string, authorId: string) {
    const rows = await this.db
      .delete(journalObservations)
      .where(
        and(
          eq(journalObservations.id, id),
          eq(journalObservations.authorId, authorId),
        ),
      )
      .returning({ id: journalObservations.id });
    return rows.length > 0;
  }

  async isEmpty() {
    const [note] = await this.db
      .select({ id: journalNotes.id })
      .from(journalNotes)
      .limit(1);
    const [observation] = await this.db
      .select({ id: journalObservations.id })
      .from(journalObservations)
      .limit(1);
    return !note && !observation;
  }

  async replaceAll(notes: JournalNote[], observations: JournalObservation[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(journalNotes);
      await tx.delete(journalObservations);
      if (notes.length)
        await tx.insert(journalNotes).values(notes.map(noteRow));
      if (observations.length)
        await tx
          .insert(journalObservations)
          .values(observations.map(observationRow));
    });
  }
}
