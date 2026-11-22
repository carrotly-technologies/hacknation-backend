import type { RequestLogEntry } from './monitor.types.js';

/** A time range, ISO 8601 bounds included; either may be missing. */
export interface TimeRange {
  from?: string;
  to?: string;
}

/**
 * Storage of the activity log (`request_log`): append-only, read by the
 * monitor, trimmed by retention.
 */
export abstract class RequestLogRepository {
  abstract insert(entry: RequestLogEntry): Promise<void>;
  /** Entries in the range, oldest first. */
  abstract list(range: TimeRange): Promise<RequestLogEntry[]>;
  /** Entries of one `X-Session-Id`, oldest first. */
  abstract listBySession(sessionId: string): Promise<RequestLogEntry[]>;
  /** Entries without a session id in the range, oldest first. */
  abstract listWithoutSession(range: TimeRange): Promise<RequestLogEntry[]>;
  /** Deletes entries before `cutoff` (ISO 8601); returns how many. */
  abstract deleteOlderThan(cutoff: string): Promise<number>;
}

export function inRange(at: string, { from, to }: TimeRange): boolean {
  return (!from || at >= from) && (!to || at <= to);
}

export function oldestFirst(a: RequestLogEntry, b: RequestLogEntry): number {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
}
