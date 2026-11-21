import { Policy } from '@nestjs/authorization';
import type { Role, User } from './user.types.js';

@Policy()
export class RolePolicy {
  hasRole(user: User | null, roles: readonly Role[]): boolean {
    return !!user && roles.includes(user.role);
  }
}
