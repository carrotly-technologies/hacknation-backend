import { z } from 'zod';
import { PATH_MAX } from './monitor.rules.js';

// Zod's own messages in Polish (also set in cases.schemas.ts).
z.config(z.locales.pl());

export const pageviewSchema = z.object({
  path: z
    .string({ error: 'Podaj ścieżkę strony.' })
    .trim()
    .min(1, { error: 'Podaj ścieżkę strony.' })
    .max(PATH_MAX, {
      error: `Ścieżka może mieć najwyżej ${PATH_MAX} znaków.`,
    })
    .refine((p) => p.startsWith('/'), {
      error: 'Ścieżka strony musi zaczynać się od „/”.',
    }),
});
export type PageviewInput = z.infer<typeof pageviewSchema>;

/** Largest page of GET /api/monitor/sessions. */
export const SESSIONS_PAGE_MAX = 200;

/** A date (YYYY-MM-DD) or a moment (ISO 8601) as an ISO string; a date `to` means its end. */
const moment = (end: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      error: 'Podaj datę w formacie RRRR-MM-DD albo ISO 8601.',
    })
    .transform((v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v)
        ? `${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z`
        : new Date(v).toISOString(),
    );

export const sessionsQuerySchema = z.object({
  from: moment(false).optional(),
  to: moment(true).optional(),
  ip: z.string().trim().max(100).optional(),
  userId: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(SESSIONS_PAGE_MAX).default(50),
});
export type SessionsQuery = z.infer<typeof sessionsQuerySchema>;
