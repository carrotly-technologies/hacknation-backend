import { z } from 'zod';

/**
 * Every `:id`, `:personId`, `:token` and `:sessionId` path parameter: letters, digits, `-`
 * and `_` (seed ids like `c-001`, UUIDs, base64url link tokens), at most 128
 * characters. Anything else answers 400 before a handler runs (ASVS V5.1.3).
 */
export const idParam = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, {
  error: 'Nieprawidłowy identyfikator w adresie.',
});
