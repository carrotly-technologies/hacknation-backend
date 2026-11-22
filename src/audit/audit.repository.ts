import type {
  AuditDraft,
  AuditEntry,
  AuditFilter,
  AuditPage,
} from './audit.types.js';

/**
 * Storage of the event log: append and read, nothing else. `append` links
 * the draft to the last entry (`sealEntry`) one write at a time, so parallel
 * requests never fork the chain.
 */
export abstract class AuditRepository {
  abstract append(draft: AuditDraft): Promise<AuditEntry>;
  /** Filtered, newest first. */
  abstract query(filter: AuditFilter): Promise<AuditPage>;
  /** Up to `limit` entries with `seq` > `afterSeq`, in chain order (for verify). */
  abstract chain(afterSeq: number, limit: number): Promise<AuditEntry[]>;
}

/** `CASE_ACTION` matches itself and `CASE_ACTION:*`. */
export function matchesAction(action: string, wanted: string): boolean {
  return action === wanted || action.startsWith(`${wanted}:`);
}
