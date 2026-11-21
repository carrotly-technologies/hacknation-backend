import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  type JournalObservationInput,
  type JournalObservationPatch,
  type NoteInput,
  noteSchema,
  observationPatchSchema,
  observationSchema,
} from './journal.schemas.js';
import { JournalService } from './journal.service.js';

/** Private journal of a supervisor; HR and ADMIN have no access. */
@Controller()
@Roles('SUPERVISOR')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get('people/:personId/notes')
  listNotes(@Param('personId') personId: string) {
    return this.journal.listNotes(personId);
  }

  @Post('people/:personId/notes')
  addNote(
    @Param('personId') personId: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.addNote(personId, body);
  }

  @Patch('notes/:id')
  updateNote(
    @Param('id') id: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.updateNote(id, body);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  async deleteNote(@Param('id') id: string): Promise<void> {
    await this.journal.deleteNote(id);
  }

  @Get('people/:personId/observations')
  listObservations(@Param('personId') personId: string) {
    return this.journal.listObservations(personId);
  }

  @Post('people/:personId/observations')
  addObservation(
    @Param('personId') personId: string,
    @Body({ schema: observationSchema }) body: JournalObservationInput,
  ) {
    return this.journal.addObservation(personId, body);
  }

  @Patch('observations/:id')
  updateObservation(
    @Param('id') id: string,
    @Body({ schema: observationPatchSchema }) body: JournalObservationPatch,
  ) {
    return this.journal.updateObservation(id, body);
  }

  @Delete('observations/:id')
  @HttpCode(204)
  async deleteObservation(@Param('id') id: string): Promise<void> {
    await this.journal.deleteObservation(id);
  }
}
