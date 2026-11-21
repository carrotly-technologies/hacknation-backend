import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticationContext } from '@nestjs/authentication';
import type { User } from '../auth/user.types.js';
import { CasesService } from '../cases/cases.service.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { JournalRepository } from './journal.repository.js';
import { observationErrors } from './journal.rules.js';
import type {
  JournalObservationInput,
  JournalObservationPatch,
  NoteInput,
} from './journal.schemas.js';
import { buildJournalSeed } from './journal.seed.js';
import type { JournalNote, JournalObservation } from './journal.types.js';

const NOTE_NOT_FOUND = 'Nie znaleziono notatki.';
const OBSERVATION_NOT_FOUND = 'Nie znaleziono obserwacji.';

/**
 * Notes and observations about an employee, all year round. The supervisor
 * reads and writes only about people from cases she evaluates; an entry is
 * visible to its author only. No entry content is ever logged.
 */
@Injectable()
export class JournalService implements OnModuleInit {
  constructor(
    @Inject(JournalRepository) private readonly repo: JournalRepository,
    private readonly cases: CasesService,
    private readonly auth: AuthenticationContext,
    private readonly demoReset: DemoReset,
  ) {}

  /** Seeds empty storage only: data already in the database is kept. */
  async onModuleInit(): Promise<void> {
    this.demoReset.register(() => this.reset());
    if (await this.repo.isEmpty()) await this.reset();
  }

  async reset(): Promise<void> {
    const seed = buildJournalSeed(this.cases.today);
    await this.repo.replaceAll(seed.notes, seed.observations);
  }

  async listNotes(personId: string): Promise<JournalNote[]> {
    return this.repo.listNotes(this.assertAccess(personId), this.authorId());
  }

  async addNote(personId: string, input: NoteInput): Promise<JournalNote> {
    this.assertAccess(personId);
    const now = new Date().toISOString();
    return this.repo.insertNote({
      id: randomUUID(),
      personId,
      authorId: this.authorId(),
      text: input.text,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateNote(id: string, input: NoteInput): Promise<JournalNote> {
    const note = await this.repo.updateNote(id, this.authorId(), {
      text: input.text,
      updatedAt: new Date().toISOString(),
    });
    if (!note) throw new NotFoundException(NOTE_NOT_FOUND);
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    if (!(await this.repo.deleteNote(id, this.authorId())))
      throw new NotFoundException(NOTE_NOT_FOUND);
  }

  async listObservations(personId: string): Promise<JournalObservation[]> {
    return this.repo.listObservations(
      this.assertAccess(personId),
      this.authorId(),
    );
  }

  async addObservation(
    personId: string,
    input: JournalObservationInput,
  ): Promise<JournalObservation> {
    this.assertAccess(personId);
    this.validate(input);
    const now = new Date().toISOString();
    return this.repo.insertObservation({
      id: randomUUID(),
      personId,
      authorId: this.authorId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateObservation(
    id: string,
    patch: JournalObservationPatch,
  ): Promise<JournalObservation> {
    const authorId = this.authorId();
    const current = await this.repo.findObservation(id, authorId);
    if (!current) throw new NotFoundException(OBSERVATION_NOT_FOUND);
    this.validate({ ...current, ...patch });
    const updated = await this.repo.updateObservation(id, authorId, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundException(OBSERVATION_NOT_FOUND);
    return updated;
  }

  async deleteObservation(id: string): Promise<void> {
    if (!(await this.repo.deleteObservation(id, this.authorId())))
      throw new NotFoundException(OBSERVATION_NOT_FOUND);
  }

  /** The signed-in user (same source as GET /api/me) is the author. */
  private user(): User {
    return this.auth.requireUser();
  }

  private authorId(): string {
    return this.user().id;
  }

  /** 404 for an unknown person, 403 for one outside the user's cases. */
  private assertAccess(personId: string): string {
    const records = this.cases.all().filter((c) => c.person.id === personId);
    if (records.length === 0)
      throw new NotFoundException(`Nie znaleziono pracownika „${personId}”.`);
    const { evaluatorId } = this.user();
    if (!evaluatorId || !records.some((c) => c.evaluatorId === evaluatorId))
      throw new ForbiddenException(
        'Notatki i obserwacje możesz prowadzić tylko o pracownikach, których oceniasz.',
      );
    return personId;
  }

  private validate(input: Parameters<typeof observationErrors>[0]): void {
    const errors = observationErrors(input, this.cases.today);
    if (errors.length > 0) throw new BadRequestException(errors);
  }
}
