import { z } from 'zod';

export const loginSchema = z.strictObject({
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

/** Sign-in methods offered by the simulated login.gov.pl (Węzeł Krajowy). */
export const LOGIN_GOV_METHODS = [
  'profil-zaufany',
  'mobywatel',
  'bank',
] as const;
export type LoginGovMethod = (typeof LOGIN_GOV_METHODS)[number];

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];

/** 11 digits with a valid check digit. */
export function isValidPesel(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const d = value.split('').map(Number);
  const sum = PESEL_WEIGHTS.reduce((acc, w, i) => acc + w * d[i], 0);
  return (10 - (sum % 10)) % 10 === d[10];
}

/** base64url of 32 random bytes (43 chars). */
const opaqueToken = (message: string) =>
  z.string({ error: message }).regex(/^[A-Za-z0-9_-]{43}$/, message);

const STATE_ERROR =
  'Sesja logowania przez login.gov.pl jest nieprawidłowa. Zacznij logowanie od nowa.';

export const loginGovAuthorizeSchema = z.strictObject({
  state: opaqueToken(STATE_ERROR),
  pesel: z
    .string({ error: 'Podaj numer PESEL.' })
    .refine(isValidPesel, 'Numer PESEL jest niepoprawny.'),
  method: z.enum(LOGIN_GOV_METHODS, {
    error: 'Wybierz metodę logowania.',
  }),
});
export type LoginGovAuthorizeInput = z.infer<typeof loginGovAuthorizeSchema>;

export const loginGovExchangeSchema = z.strictObject({
  artifact: opaqueToken(
    'Link logowania jest nieprawidłowy. Zaloguj się ponownie.',
  ),
  state: opaqueToken(STATE_ERROR),
});
export type LoginGovExchangeInput = z.infer<typeof loginGovExchangeSchema>;
