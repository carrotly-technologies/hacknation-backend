import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { type UpdatePerson, updatePersonSchema } from './people.schemas.js';
import { PeopleService } from './people.service.js';
import type { PersonProfile } from './people.types.js';
import { idParam } from '../security/params.schemas.js';

@ApiTags('people')
@ApiNotFoundResponse({
  description: 'Nieznany pracownik albo spoza zespołu przełożonego.',
})
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /** Employee profile: data, supervisor, assessment history, current case. */
  @Get(':personId')
  @Roles('SUPERVISOR', 'HR')
  @ApiOperation({
    summary:
      'Profil pracownika: dane, przełożony, historia ocen, bieżąca sprawa',
  })
  @ApiOkResponse({ description: 'Profil (`PersonProfile`).' })
  profile(
    @Param('personId', { schema: idParam }) personId: string,
  ): Promise<PersonProfile> {
    return this.people.profile(personId);
  }

  /** Basic employee data, written to every case of the person. */
  @Patch(':personId')
  @Roles('SUPERVISOR', 'HR')
  @ApiOperation({
    summary: 'Zmiana podstawowych danych pracownika (we wszystkich sprawach)',
  })
  @ApiOkResponse({ description: 'Profil po zmianie (`PersonProfile`).' })
  update(
    @Param('personId', { schema: idParam }) personId: string,
    @Body({ schema: updatePersonSchema }) body: UpdatePerson,
  ): Promise<PersonProfile> {
    return this.people.update(personId, body);
  }
}
