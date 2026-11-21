import { Can } from '@nestjs/authorization';
import { RolePolicy } from './role.policy.js';
import type { Role } from './user.types.js';

/** Only these roles may call the route (403 for any other signed-in role). */
export const Roles = (...roles: Role[]) =>
  Can(RolePolicy, 'hasRole', () => [roles]);
