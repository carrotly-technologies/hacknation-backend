import { sealEntry } from './audit-chain.js';
import { AuditRepository, matchesAction } from './audit.repository.js';
import type {
  AuditDraft,
  AuditEntry,
  AuditFilter,
  AuditPage,
} from './audit.types.js';

const copy = (e: AuditEntry): AuditEntry => ({
  ...e,
  changedFields: [...e.changedFields],
});

/**
 * Used without DATABASE_URL: the chain lives in this process only (lost on
 * restart, one chain per instance). Same chain as PostgreSQL, without the
 * trigger; there is simply no method that changes or removes an entry.
 */
export class InMemoryAuditRepository extends AuditRepository {
  private readonly entries: AuditEntry[] = [];
  /** Appends run one after another, like the advisory lock in PostgreSQL. */
  private queue: Promise<unknown> = Promise.resolve();

  append(draft: AuditDraft): Promise<AuditEntry> {
    const write = this.queue.then(() => {
      const last = this.entries.at(-1) ?? null;
      const entry = sealEntry(draft, last);
      this.entries.push(entry);
      return copy(entry);
    });
    this.queue = write.catch(() => undefined);
    return write;
  }

  async query(filter: AuditFilter): Promise<AuditPage> {
    const matching = this.entries
      .filter(
        (e) =>
          (!filter.actorId || e.actorId === filter.actorId) &&
          (!filter.action || matchesAction(e.action, filter.action)) &&
          (!filter.from || Date.parse(e.at) >= Date.parse(filter.from)) &&
          (!filter.to || Date.parse(e.at) <= Date.parse(filter.to)),
      )
      .reverse();
    return {
      items: matching
        .slice(filter.offset, filter.offset + filter.limit)
        .map(copy),
      total: matching.length,
    };
  }

  async chain(afterSeq: number, limit: number): Promise<AuditEntry[]> {
    return this.entries
      .filter((e) => e.seq > afterSeq)
      .slice(0, limit)
      .map(copy);
  }
}
