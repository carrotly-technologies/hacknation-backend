import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
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
}
