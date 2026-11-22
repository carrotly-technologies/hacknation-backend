import { createHash } from 'node:crypto';
import type { AuditDraft, AuditEntry } from './audit.types.js';

/** prevHash of the first entry. */
export const GENESIS_HASH = '0'.repeat(64);

/** The link an entry needs from its predecessor (null for the first one). */
export interface ChainTip {
  seq: number;
  hash: string;
}

/** JSON with object keys sorted at every level, so the same entry always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** sha256(prevHash || canonical JSON of every field except `hash`), hex. */
export function hashEntry(entry: Omit<AuditEntry, 'hash'>): string {
  const payload: Omit<AuditEntry, 'hash'> = {
    seq: entry.seq,
    id: entry.id,
    at: entry.at,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    changedFields: entry.changedFields,
    ip: entry.ip,
    result: entry.result,
    prevHash: entry.prevHash,
  };
  return createHash('sha256')
    .update(entry.prevHash)
    .update(canonicalJson(payload))
    .digest('hex');
}

/** The next entry of the chain after `tip`. */
export function sealEntry(draft: AuditDraft, tip: ChainTip | null): AuditEntry {
  const unsealed = {
    ...draft,
    at: draft.at ?? new Date().toISOString(),
    changedFields: [...draft.changedFields],
    seq: (tip?.seq ?? 0) + 1,
    prevHash: tip?.hash ?? GENESIS_HASH,
  };
  return { ...unsealed, hash: hashEntry(unsealed) };
}

/**
 * Checks entries in chain order, continuing from `tip` (null at the start),
 * so a long log can be checked page by page. Returns the new tip, or the id
 * of the first entry that does not match: a changed field, a changed hash, a
 * removed or reordered entry all break the link (`validBefore`: how many
 * entries of `entries` were fine before it).
 */
export function verifyEntries(
  entries: readonly AuditEntry[],
  tip: ChainTip | null,
): { tip: ChainTip | null } | { brokenId: string; validBefore: number } {
  let current = tip;
  for (const [index, entry] of entries.entries()) {
    const linked =
      entry.seq === (current?.seq ?? 0) + 1 &&
      entry.prevHash === (current?.hash ?? GENESIS_HASH);
    if (!linked || hashEntry(entry) !== entry.hash) {
      return { brokenId: entry.id, validBefore: index };
    }
    current = { seq: entry.seq, hash: entry.hash };
  }
  return { tip: current };
}
