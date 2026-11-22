import { and, asc, count, desc, eq, gt, gte, lte, or, sql } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import { sealEntry } from './audit-chain.js';
import { AuditRepository } from './audit.repository.js';
import { auditLog } from './audit.tables.js';
import type {
  AuditDraft,
  AuditEntry,
  AuditFilter,
  AuditPage,
} from './audit.types.js';

type Row = typeof auditLog.$inferSelect;

/** Key of the transaction-level advisory lock that serialises appends. */
const AUDIT_LOCK_KEY = 70_070;

const toEntry = (row: Row): AuditEntry => ({
  ...row,
  at: row.at.toISOString(),
});

const toRow = (e: AuditEntry): Row => ({ ...e, at: new Date(e.at) });

/**
 * Used with DATABASE_URL: table audit_log, append-only by a trigger. Every
 * append takes `pg_advisory_xact_lock`, reads the last entry and inserts the
 * next one in the same transaction, so parallel requests (also from several
 * app instances) form one chain; the unique `seq` and `prev_hash` back it up.
 */
export class PostgresAuditRepository extends AuditRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async append(draft: AuditDraft): Promise<AuditEntry> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);
      const [last] = await tx
        .select({ seq: auditLog.seq, hash: auditLog.hash })
        .from(auditLog)
        .orderBy(desc(auditLog.seq))
        .limit(1);
      const entry = sealEntry(draft, last ?? null);
      await tx.insert(auditLog).values(toRow(entry));
      return entry;
    });
  }

  async query(filter: AuditFilter): Promise<AuditPage> {
    const where = and(
      filter.actorId ? eq(auditLog.actorId, filter.actorId) : undefined,
      filter.action
        ? or(
            eq(auditLog.action, filter.action),
            sql`starts_with(${auditLog.action}, ${`${filter.action}:`})`,
          )
        : undefined,
      filter.from ? gte(auditLog.at, new Date(filter.from)) : undefined,
      filter.to ? lte(auditLog.at, new Date(filter.to)) : undefined,
    );
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.seq))
      .offset(filter.offset)
      .limit(filter.limit);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(auditLog)
      .where(where);
    return { items: rows.map(toEntry), total: Number(total) };
  }

  async chain(afterSeq: number, limit: number): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(gt(auditLog.seq, afterSeq))
      .orderBy(asc(auditLog.seq))
      .limit(limit);
    return rows.map(toEntry);
  }
}
