import { z } from 'zod';
import { OBJECTION_MAX_LENGTH } from '../cases/objection.rules.js';

export const confirmAckSchema = z.object({
  confirmed: z.literal(true, {
    error:
      'Zaznacz potwierdzenie, że przeprowadzono z Tobą rozmowę oceniającą i zapoznałeś(-łaś) się z oceną.',
  }),
});
export type ConfirmAckInput = z.infer<typeof confirmAckSchema>;

export const objectionSchema = z.object({
  text: z
    .string({ error: 'Wpisz treść zastrzeżeń.' })
    .trim()
    .min(1, { error: 'Wpisz treść zastrzeżeń.' })
    .max(OBJECTION_MAX_LENGTH, {
      error: `Treść zastrzeżeń może mieć najwyżej ${OBJECTION_MAX_LENGTH} znaków.`,
    }),
  confirmed: z.literal(true, {
    error:
      'Zaznacz, że wnosisz sprzeciw od oceny do dyrektora generalnego urzędu.',
  }),
});
export type ObjectionInput = z.infer<typeof objectionSchema>;
