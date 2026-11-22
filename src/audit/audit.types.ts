import type { Role } from '../auth/user.types.js';

/** `ASSESSED_VIA_LINK`: the assessed person on the public /api/ack/:token page. */
export type AuditActorRole = Role | 'ASSESSED_VIA_LINK';

/** OK: done; DENIED: 401/403/429; ERROR: refused for another reason (400, 404, 409, 500). */
export const AUDIT_RESULTS = ['OK', 'DENIED', 'ERROR'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

/**
 * What an entry says before it joins the chain. Data minimisation (RODO):
 * `changedFields` holds field names only, never values (no ratings,
 * justifications, notes or passwords); the actor is an account id, never a
 * name.
 */
export interface AuditDraft {
  id: string;
  /**
   * ISO timestamp (UTC, milliseconds). Left out, it is set when the entry
   * joins the chain (under the lock), so time order follows chain order.
   */
  at?: string;
  actorId: string | null;
  actorRole: AuditActorRole | null;
  /** E.g. `CASE_ACTION:SEND_FOR_ACK`, `CASE_PATCH`, `LOGIN_FAILED`. */
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  changedFields: string[];
  /** Client IP (personal data under RODO, kept for security, see README). */
  ip: string | null;
  result: AuditResult;
}

/** A sealed entry: its place in the chain and the hashes that link it. */
export interface AuditEntry extends AuditDraft {
  at: string;
  /** 1, 2, 3… in write order; the chain order. */
  seq: number;
  /** `hash` of the previous entry; 64 zeros for the first one. */
  prevHash: string;
  /** sha256(prevHash || canonical JSON of every other field), hex. */
  hash: string;
}

export interface AuditFilter {
  actorId?: string;
  /** Exact action, or a family: `CASE_ACTION` matches `CASE_ACTION:*`. */
  action?: string;
  /** Inclusive ISO timestamps. */
  from?: string;
  to?: string;
  offset: number;
  limit: number;
}

export interface AuditPage {
  /** Newest first. */
  items: AuditEntry[];
  total: number;
}

/** GET /api/admin/audit/verify */
export type AuditVerification =
  | { ok: true; count: number }
  /** `count`: entries that checked out before the first broken one. */
  | { ok: false; count: number; firstBrokenId: string };
