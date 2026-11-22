import {
  inRange,
  oldestFirst,
  RequestLogRepository,
  type TimeRange,
} from './request-log.repository.js';
import type { RequestLogEntry } from './monitor.types.js';

/** Most entries kept in memory; the oldest go first beyond it. */
export const IN_MEMORY_MAX_ENTRIES = 50_000;

/** Used without DATABASE_URL: the log lives in this process only. */
export class InMemoryRequestLogRepository extends RequestLogRepository {
  private entries: RequestLogEntry[] = [];

  constructor(private readonly maxEntries = IN_MEMORY_MAX_ENTRIES) {
    super();
  }

  async insert(entry: RequestLogEntry) {
    this.entries.push({ ...entry });
    if (this.entries.length > this.maxEntries)
      this.entries.splice(0, this.entries.length - this.maxEntries);
  }

  async list(range: TimeRange) {
    return this.select((e) => inRange(e.at, range));
  }

  async listBySession(sessionId: string) {
    return this.select((e) => e.sessionId === sessionId);
  }

  async listWithoutSession(range: TimeRange) {
    return this.select((e) => e.sessionId === null && inRange(e.at, range));
  }

  async deleteOlderThan(cutoff: string) {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.at >= cutoff);
    return before - this.entries.length;
  }

  private select(keep: (e: RequestLogEntry) => boolean) {
    return this.entries
      .filter(keep)
      .sort(oldestFirst)
      .map((e) => ({ ...e }));
  }
}
