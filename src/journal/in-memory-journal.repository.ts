import {
  JournalRepository,
  newestNotesFirst,
  newestObservationsFirst,
} from './journal.repository.js';
import type {
  JournalNote,
  JournalObservation,
  ObservationFields,
} from './journal.types.js';

/** Used without DATABASE_URL: data lives in this process only. */
export class InMemoryJournalRepository extends JournalRepository {
  private notes = new Map<string, JournalNote>();
  private observations = new Map<string, JournalObservation>();

  async listNotes(personId: string, authorId: string) {
    return [...this.notes.values()]
      .filter((n) => n.personId === personId && n.authorId === authorId)
      .sort(newestNotesFirst)
      .map((n) => ({ ...n }));
  }

  async insertNote(note: JournalNote) {
    this.notes.set(note.id, { ...note });
    return { ...note };
  }

  async updateNote(
    id: string,
    authorId: string,
    changes: Pick<JournalNote, 'text' | 'updatedAt'>,
  ) {
    const note = this.notes.get(id);
    if (!note || note.authorId !== authorId) return null;
    const next = { ...note, ...changes };
    this.notes.set(id, next);
    return { ...next };
  }

  async deleteNote(id: string, authorId: string) {
    const note = this.notes.get(id);
    if (!note || note.authorId !== authorId) return false;
    return this.notes.delete(id);
  }

  async listObservations(personId: string, authorId: string) {
    return [...this.observations.values()]
      .filter((o) => o.personId === personId && o.authorId === authorId)
      .sort(newestObservationsFirst)
      .map((o) => ({ ...o }));
  }

  async findObservation(id: string, authorId: string) {
    const observation = this.observations.get(id);
    return observation && observation.authorId === authorId
      ? { ...observation }
      : null;
  }

  async insertObservation(observation: JournalObservation) {
    this.observations.set(observation.id, { ...observation });
    return { ...observation };
  }

  async updateObservation(
    id: string,
    authorId: string,
    changes: Partial<ObservationFields> & { updatedAt: string },
  ) {
    const observation = this.observations.get(id);
    if (!observation || observation.authorId !== authorId) return null;
    const next = { ...observation, ...changes };
    this.observations.set(id, next);
    return { ...next };
  }

  async deleteObservation(id: string, authorId: string) {
    const observation = this.observations.get(id);
    if (!observation || observation.authorId !== authorId) return false;
    return this.observations.delete(id);
  }

  async isEmpty() {
    return this.notes.size === 0 && this.observations.size === 0;
  }

  async replaceAll(notes: JournalNote[], observations: JournalObservation[]) {
    this.notes = new Map(notes.map((n) => [n.id, { ...n }]));
    this.observations = new Map(observations.map((o) => [o.id, { ...o }]));
  }
}
