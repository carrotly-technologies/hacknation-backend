import { and, desc, eq, lt } from 'drizzle-orm';
import type { FieldCipher } from '../crypto/field-cipher.js';
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

/** Free text about the assessed person, encrypted at rest (field-cipher.ts). */
const OBSERVATION_TEXT = ['situation', 'action', 'result'] as const;

type ObservationText = Partial<
  Record<(typeof OBSERVATION_TEXT)[number], string>
>;

/** The value with its observation S-D-R fields encrypted (others as they are). */
function encryptObservationText<T extends ObservationText>(
  cipher: FieldCipher,
  value: T,
): T {
  const next: T = { ...value };
  for (const field of OBSERVATION_TEXT) {
    const plain = value[field];
    if (plain !== undefined)
      next[field] = cipher.encrypt(plain) as T[typeof field];
  }
  return next;
}

/**
 * Used with DATABASE_URL: tables journal_notes and journal_observations. The
 * note text and the S-D-R of an observation are stored encrypted
 * (`v1:<iv>:<tag>:<ciphertext>`); everything else stays queryable.
 */
export class PostgresJournalRepository extends JournalRepository {
  constructor(
    private readonly db: Database,
    private readonly cipher: FieldCipher,
  ) {
    super();
  }

  private toNote = (row: NoteRow): JournalNote => ({
    ...row,
    text: this.cipher.decrypt(row.text),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  private toObservation = (row: ObservationRow): JournalObservation => ({
    ...row,
    situation: this.cipher.decrypt(row.situation),
    action: this.cipher.decrypt(row.action),
    result: this.cipher.decrypt(row.result),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  private noteRow = (n: JournalNote) => ({
    ...n,
    text: this.cipher.encrypt(n.text),
    createdAt: new Date(n.createdAt),
    updatedAt: new Date(n.updatedAt),
  });

  private observationRow = (o: JournalObservation) => ({
    ...encryptObservationText(this.cipher, o),
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
  });

  /**
   * Data migration run at startup, after the schema migrations: encrypts
   * every note and observation still stored as plain text (or with the dev
   * key) with the current key. Idempotent: rows already encrypted with the
   * current key are not touched, so a second run changes nothing.
   */
  async encryptStoredText(): Promise<{ notes: number; observations: number }> {
    return this.db.transaction(async (tx) => {
      let notes = 0;
      for (const row of await tx
        .select({ id: journalNotes.id, text: journalNotes.text })
        .from(journalNotes)) {
        if (!this.cipher.needsEncryption(row.text)) continue;
        await tx
          .update(journalNotes)
          .set({ text: this.cipher.encrypt(this.cipher.decrypt(row.text)) })
          .where(eq(journalNotes.id, row.id));
        notes += 1;
      }
      let observations = 0;
      for (const row of await tx
        .select({
          id: journalObservations.id,
          situation: journalObservations.situation,
          action: journalObservations.action,
          result: journalObservations.result,
        })
        .from(journalObservations)) {
        if (!OBSERVATION_TEXT.some((f) => this.cipher.needsEncryption(row[f])))
          continue;
        const plain = {
          situation: this.cipher.decrypt(row.situation),
          action: this.cipher.decrypt(row.action),
          result: this.cipher.decrypt(row.result),
        };
        await tx
          .update(journalObservations)
          .set(encryptObservationText(this.cipher, plain))
          .where(eq(journalObservations.id, row.id));
        observations += 1;
      }
      return { notes, observations };
    });
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
    return rows.map(this.toNote);
  }

  async insertNote(note: JournalNote) {
    const [row] = await this.db
      .insert(journalNotes)
      .values(this.noteRow(note))
      .returning();
    return this.toNote(row);
  }

  async updateNote(
    id: string,
    authorId: string,
    changes: Pick<JournalNote, 'text' | 'updatedAt'>,
  ) {
    const [row] = await this.db
      .update(journalNotes)
      .set({
        text: this.cipher.encrypt(changes.text),
        updatedAt: new Date(changes.updatedAt),
      })
      .where(and(eq(journalNotes.id, id), eq(journalNotes.authorId, authorId)))
      .returning();
    return row ? this.toNote(row) : null;
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
    return rows.map(this.toObservation);
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
    return row ? this.toObservation(row) : null;
  }

  async insertObservation(observation: JournalObservation) {
    const [row] = await this.db
      .insert(journalObservations)
      .values(this.observationRow(observation))
      .returning();
    return this.toObservation(row);
  }

  async updateObservation(
    id: string,
    authorId: string,
    changes: Partial<ObservationFields> & { updatedAt: string },
  ) {
    const [row] = await this.db
      .update(journalObservations)
      .set({
        ...encryptObservationText(this.cipher, changes),
        updatedAt: new Date(changes.updatedAt),
      })
      .where(
        and(
          eq(journalObservations.id, id),
          eq(journalObservations.authorId, authorId),
        ),
      )
      .returning();
    return row ? this.toObservation(row) : null;
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
        await tx.insert(journalNotes).values(notes.map(this.noteRow));
      if (observations.length)
        await tx
          .insert(journalObservations)
          .values(observations.map(this.observationRow));
    });
  }

  async deleteOlderThan(cutoff: string) {
    const notes = await this.db
      .delete(journalNotes)
      .where(lt(journalNotes.updatedAt, new Date(`${cutoff}T00:00:00.000Z`)))
      .returning({ id: journalNotes.id });
    const observations = await this.db
      .delete(journalObservations)
      .where(lt(journalObservations.date, cutoff))
      .returning({ id: journalObservations.id });
    return { notes: notes.length, observations: observations.length };
  }
}
