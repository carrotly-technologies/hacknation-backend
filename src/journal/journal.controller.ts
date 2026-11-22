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
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
import { idParam } from '../security/params.schemas.js';

/** Private journal of a supervisor; HR and ADMIN have no access. */
@ApiTags('journal')
@Controller()
@Roles('SUPERVISOR')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get('people/:personId/notes')
  @ApiOperation({ summary: 'Moje notatki o pracowniku' })
  @ApiOkResponse({ description: 'Notatki.' })
  @ApiNotFoundResponse({ description: 'Nieznany pracownik.' })
  listNotes(@Param('personId', { schema: idParam }) personId: string) {
    return this.journal.listNotes(personId);
  }

  @Post('people/:personId/notes')
  @ApiOperation({ summary: 'Nowa notatka o pracowniku' })
  @ApiCreatedResponse({ description: 'Notatka.' })
  @ApiNotFoundResponse({ description: 'Nieznany pracownik.' })
  addNote(
    @Param('personId', { schema: idParam }) personId: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.addNote(personId, body);
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Zmiana treści notatki' })
  @ApiOkResponse({ description: 'Notatka z nowym `updatedAt`.' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej notatki.' })
  updateNote(
    @Param('id', { schema: idParam }) id: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.updateNote(id, body);
  }

  @Delete('notes/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Usunięcie notatki' })
  @ApiNoContentResponse({ description: 'Usunięto.' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej notatki.' })
  async deleteNote(
    @Param('id', { schema: idParam }) id: string,
  ): Promise<void> {
    await this.journal.deleteNote(id);
  }

  @Get('people/:personId/observations')
  @ApiOperation({ summary: 'Moje obserwacje S-D-R o pracowniku' })
  @ApiOkResponse({ description: 'Obserwacje według daty.' })
  @ApiNotFoundResponse({ description: 'Nieznany pracownik.' })
  listObservations(@Param('personId', { schema: idParam }) personId: string) {
    return this.journal.listObservations(personId);
  }

  @Post('people/:personId/observations')
  @ApiOperation({ summary: 'Nowa obserwacja S-D-R o pracowniku' })
  @ApiCreatedResponse({ description: 'Obserwacja.' })
  @ApiNotFoundResponse({ description: 'Nieznany pracownik.' })
  addObservation(
    @Param('personId', { schema: idParam }) personId: string,
    @Body({ schema: observationSchema }) body: JournalObservationInput,
  ) {
    return this.journal.addObservation(personId, body);
  }

  @Patch('observations/:id')
  @ApiOperation({ summary: 'Zmiana obserwacji (dowolne pola)' })
  @ApiOkResponse({ description: 'Obserwacja po zmianie.' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej obserwacji.' })
  updateObservation(
    @Param('id', { schema: idParam }) id: string,
    @Body({ schema: observationPatchSchema }) body: JournalObservationPatch,
  ) {
    return this.journal.updateObservation(id, body);
  }

  @Delete('observations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Usunięcie obserwacji' })
  @ApiNoContentResponse({ description: 'Usunięto.' })
  @ApiNotFoundResponse({ description: 'Nie ma takiej obserwacji.' })
  async deleteObservation(
    @Param('id', { schema: idParam }) id: string,
  ): Promise<void> {
    await this.journal.deleteObservation(id);
  }
}
