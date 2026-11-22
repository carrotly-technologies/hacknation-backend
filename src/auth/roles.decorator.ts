import { applyDecorators } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { RolePolicy } from './role.policy.js';
import type { Role } from './user.types.js';

/** Only these roles may call the route (403 for any other signed-in role). */
export const Roles = (...roles: Role[]) =>
  applyDecorators(
    Can(RolePolicy, 'hasRole', () => [roles]),
    ApiForbiddenResponse({
      description: `Brak uprawnień: tylko rola ${roles.join(' lub ')}.`,
    }),
  );
