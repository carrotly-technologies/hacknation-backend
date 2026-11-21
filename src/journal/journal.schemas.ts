import { z } from 'zod';
import { isIsoDate } from '../cases/dates.js';

// Zod's own messages in Polish (also set in cases.schemas.ts).
z.config(z.locales.pl());

/** Text limits of journal entries (product decision, not a regulation). */
export const NOTE_MAX = 5000;
export const SDR_MAX = 2000;

const sdr = (label: string) =>
  z
    .string({ error: `Opisz ${label}.` })
    .trim()
    .min(1, { error: `Opisz ${label}.` })
    .max(SDR_MAX, {
      error: `Opis (${label}) może mieć najwyżej ${SDR_MAX} znaków.`,
    });

export const noteSchema = z.object({
  text: z
    .string({ error: 'Podaj treść notatki.' })
    .trim()
    .min(1, { error: 'Treść notatki nie może być pusta.' })
    .max(NOTE_MAX, {
      error: `Notatka może mieć najwyżej ${NOTE_MAX} znaków.`,
    }),
});
export type NoteInput = z.infer<typeof noteSchema>;

const observationFields = {
  date: z
    .string({ error: 'Podaj datę obserwacji.' })
    .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' }),
  criterionId: z
    .string({ error: 'Wybierz kryterium.' })
    .min(1, { error: 'Wybierz kryterium.' }),
  indicatorId: z.string().min(1).nullable(),
  kind: z.enum(['STRENGTH', 'DEVELOPMENT'], {
    error:
      'kind musi mieć wartość STRENGTH (mocna strona) albo DEVELOPMENT (do rozwoju).',
  }),
  situation: sdr('sytuację (S)'),
  action: sdr('działanie (D)'),
  result: sdr('rezultat (R)'),
};

export const observationSchema = z.object({
  ...observationFields,
  indicatorId: observationFields.indicatorId.optional().default(null),
});
export type JournalObservationInput = z.infer<typeof observationSchema>;

export const observationPatchSchema = z.object(observationFields).partial();
export type JournalObservationPatch = z.infer<typeof observationPatchSchema>;
