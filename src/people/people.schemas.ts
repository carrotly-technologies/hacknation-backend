import { z } from 'zod';
import { isIsoDate } from '../cases/dates.js';

// Zod's own messages in Polish (also set in cases.schemas.ts).
z.config(z.locales.pl());

const text = (error: string) => z.string({ error }).trim().min(1, { error });

/** PATCH /api/people/:personId: the basic employee data, all required. */
export const updatePersonSchema = z.object({
  position: text('Podaj stanowisko.'),
  unit: text('Podaj komórkę organizacyjną.'),
  employment: z.enum(['URZEDNIK', 'PRACOWNIK'], {
    error: 'Wybierz status zatrudnienia.',
  }),
  hiredOn: z
    .string({ error: 'Podaj datę zatrudnienia.' })
    .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' }),
});
export type UpdatePerson = z.infer<typeof updatePersonSchema>;
