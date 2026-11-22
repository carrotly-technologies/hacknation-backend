import type { Request } from 'express';
import type { User } from '../auth/user.types.js';

const AUDITED = Symbol('audit.recorded');
const RESOURCE_ID = Symbol('audit.resourceId');

/** The Express request as the audit sees it. */
export type AuditableRequest = Request & {
  user?: User | null;
  [AUDITED]?: true;
  [RESOURCE_ID]?: string | null;
};

/** The interceptor took this request, so the finish hook leaves it alone. */
export function markAudited(req: AuditableRequest): void {
  req[AUDITED] = true;
}

export function isAudited(req: AuditableRequest): boolean {
  return req[AUDITED] === true;
}

/**
 * Names the resource of a request whose URL does not carry it, e.g. the
 * case behind an /api/ack/:token link (the token itself is never logged).
 */
export function setAuditResourceId(req: Request, id: string | null): void {
  (req as AuditableRequest)[RESOURCE_ID] = id;
}

export function auditResourceIdOf(req: AuditableRequest): string | null {
  return req[RESOURCE_ID] ?? null;
}

/** Status of a thrown error: HttpException, AuthorizationError, else 500. */
export function statusOf(error: unknown): number {
  const e = error as { getStatus?: () => number; status?: unknown } | null;
  if (typeof e?.getStatus === 'function') return e.getStatus();
  if (typeof e?.status === 'number') return e.status;
  return 500;
}

/** 401/403/429 are refusals of the caller; anything else ≥ 400 is an error. */
export function resultOfStatus(status: number): 'OK' | 'DENIED' | 'ERROR' {
  if (status < 400) return 'OK';
  if (status === 401 || status === 403 || status === 429) return 'DENIED';
  return 'ERROR';
}
