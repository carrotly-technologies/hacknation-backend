import { z } from 'zod';

z.config(z.locales.pl());

/** Page size of GET /api/admin/audit (product decision, not a regulation). */
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_PAGE_SIZE_MAX = 200;

const timestamp = (name: string) =>
  z
    .string()
    .refine(
      (v) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)),
      {
        error: `${name} musi być datą ISO (np. 2026-11-21 albo 2026-11-21T23:59:59.999Z).`,
      },
    )
    .transform((v) => new Date(v).toISOString())
    .optional();

const positiveInt = (name: string, max?: number) => {
  let schema = z.coerce
    .number({ error: `${name} musi być liczbą.` })
    .int({ error: `${name} musi być liczbą całkowitą.` })
    .min(1, { error: `${name} musi być większe od zera.` });
  if (max)
    schema = schema.max(max, {
      error: `${name} może wynosić najwyżej ${max}.`,
    });
  return schema;
};

/** GET /api/admin/audit. `from`/`to` are inclusive; the frontend sends the local day's bounds. */
export const auditQuerySchema = z.strictObject({
  actorId: z.string().trim().min(1).max(200).optional(),
  action: z
    .string()
    .regex(/^[A-Z_]+(:[A-Z_]+)?$/, {
      error:
        'action musi być nazwą akcji z GET /api/admin/audit/actions (np. CASE_PATCH albo CASE_ACTION).',
    })
    .optional(),
  from: timestamp('from'),
  to: timestamp('to'),
  page: positiveInt('page').default(1),
  pageSize: positiveInt('pageSize', AUDIT_PAGE_SIZE_MAX).default(
    AUDIT_PAGE_SIZE,
  ),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
