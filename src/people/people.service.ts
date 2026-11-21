import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import { CasePolicy } from '../auth/case.policy.js';
import type { CaseRecord } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { buildProfile } from './people.rules.js';
import type { PersonProfile } from './people.types.js';

/**
 * The employee profile. Built only from the person's cases the caller may
 * read (CasePolicy.view): a supervisor's own team, every person for HR.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly cases: CasesService,
    private readonly auth: AuthenticationContext,
    private readonly authorization: AuthorizationService,
  ) {}

  /** 404 both for an unknown person and for someone the caller may not see. */
  async profile(personId: string): Promise<PersonProfile> {
    const user = this.auth.requireUser();
    const visible: CaseRecord[] = [];
    for (const record of this.cases.all()) {
      if (
        record.person.id === personId &&
        (await this.authorization.can(CasePolicy, 'view', user, record))
      ) {
        visible.push(record);
      }
    }
    const profile = buildProfile(visible, this.cases.today, (r) =>
      this.cases.evaluatorOf(r),
    );
    if (!profile)
      throw new NotFoundException(`Nie znaleziono pracownika „${personId}”.`);
    return profile;
  }
}
