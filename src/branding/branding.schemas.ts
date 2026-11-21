import { z } from 'zod';
import { LOGO_IDS } from './logos.js';

export const acceptLogoSchema = z.object({
  logoId: z.enum(LOGO_IDS, {
    error: (issue) =>
      issue.input === undefined
        ? 'Wybierz logo.'
        : `Nie ma propozycji logo „${typeof issue.input === 'string' ? issue.input : JSON.stringify(issue.input)}”. Wybierz jedną z propozycji na stronie /logo.`,
  }),
});
export type AcceptLogoInput = z.infer<typeof acceptLogoSchema>;
