import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { type UpdatePerson, updatePersonSchema } from './people.schemas.js';
import { PeopleService } from './people.service.js';
import type { PersonProfile } from './people.types.js';

@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /** Employee profile: data, supervisor, assessment history, current case. */
  @Get(':personId')
  @Roles('SUPERVISOR', 'HR')
  profile(@Param('personId') personId: string): Promise<PersonProfile> {
    return this.people.profile(personId);
  }

  /** Basic employee data, written to every case of the person. */
  @Patch(':personId')
  @Roles('SUPERVISOR', 'HR')
  update(
    @Param('personId') personId: string,
    @Body({ schema: updatePersonSchema }) body: UpdatePerson,
  ): Promise<PersonProfile> {
    return this.people.update(personId, body);
  }
}
