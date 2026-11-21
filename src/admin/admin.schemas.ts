import { z } from 'zod';
import { ROLES } from '../auth/user.types.js';

export const updateUserSchema = z.object({
  role: z.enum(ROLES, {
    error: `Rola musi być jedną z: ${ROLES.join(', ')}.`,
  }),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
