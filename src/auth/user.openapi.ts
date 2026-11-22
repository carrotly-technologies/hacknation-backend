import type { SchemaObject } from '@nestjs/swagger';
import { ROLES } from './user.types.js';

/** OpenAPI schema of `UserView` (an account without the password hash). */
export const USER_VIEW_SCHEMA: SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    login: { type: 'string' },
    name: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    role: { type: 'string', enum: [...ROLES] },
    position: { type: 'string' },
    unit: { type: 'string' },
  },
  required: [
    'id',
    'login',
    'name',
    'firstName',
    'lastName',
    'role',
    'position',
    'unit',
  ],
};
