import { Policy } from '@nestjs/authorization';
import type { CaseRecord } from '../cases/case.types.js';
import type { User } from './user.types.js';

/** Record checks for assessment cases, called from CasesService. */
@Policy()
export class CasePolicy {
  /** A supervisor reads own cases; HR reads every case (statuses, deadlines). */
  view(user: User | null, record: CaseRecord): boolean {
    if (user?.role === 'HR') return true;
    return isOwnCase(user, record);
  }

  /** Only the case's evaluator edits it (PATCH, observations, actions). */
  edit(user: User | null, record: CaseRecord): boolean {
    return isOwnCase(user, record);
  }
}

function isOwnCase(user: User | null, record: CaseRecord): boolean {
  return (
    user?.role === 'SUPERVISOR' &&
    !!user.evaluatorId &&
    record.evaluatorId === user.evaluatorId
  );
}
