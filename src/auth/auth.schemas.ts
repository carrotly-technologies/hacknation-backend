import { z } from 'zod';

export const loginSchema = z.object({
  login: z
    .string({ error: 'Podaj login.' })
    .trim()
    .min(1, 'Podaj login.')
    .max(200),
  password: z
    .string({ error: 'Podaj hasło.' })
    .min(1, 'Podaj hasło.')
    .max(1024),
});
export type LoginInput = z.infer<typeof loginSchema>;
