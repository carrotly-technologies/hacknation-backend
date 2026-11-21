import { z } from 'zod';

export const confirmAckSchema = z.object({
  confirmed: z.literal(true, {
    error:
      'Zaznacz potwierdzenie, że przeprowadzono z Tobą rozmowę oceniającą i zapoznałeś(-łaś) się z oceną.',
  }),
});
export type ConfirmAckInput = z.infer<typeof confirmAckSchema>;
