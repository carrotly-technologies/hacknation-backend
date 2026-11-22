import { and, asc, eq, gte, isNull, lt, lte, type SQL } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import { requestLog } from './monitor.tables.js';
import type { RequestLogEntry } from './monitor.types.js';
import {
  RequestLogRepository,
  type TimeRange,
} from './request-log.repository.js';

type Row = typeof requestLog.$inferSelect;

const toEntry = (row: Row): RequestLogEntry => ({
  ...row,
  at: row.at.toISOString(),
});

const rangeConditions = ({ from, to }: TimeRange): SQL[] => [
  ...(from ? [gte(requestLog.at, new Date(from))] : []),
  ...(to ? [lte(requestLog.at, new Date(to))] : []),
];

/** Used with DATABASE_URL: table request_log. */
export class PostgresRequestLogRepository extends RequestLogRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async insert(entry: RequestLogEntry) {
    await this.db
      .insert(requestLog)
      .values({ ...entry, at: new Date(entry.at) });
  }

  async list(range: TimeRange) {
    return this.select(and(...rangeConditions(range)));
  }

  async listBySession(sessionId: string) {
    return this.select(eq(requestLog.sessionId, sessionId));
  }

  async listWithoutSession(range: TimeRange) {
    return this.select(
      and(isNull(requestLog.sessionId), ...rangeConditions(range)),
    );
  }

  async deleteOlderThan(cutoff: string) {
    const rows = await this.db
      .delete(requestLog)
      .where(lt(requestLog.at, new Date(cutoff)))
      .returning({ id: requestLog.id });
    return rows.length;
  }

  async deleteAll() {
    const rows = await this.db
      .delete(requestLog)
      .returning({ id: requestLog.id });
    return rows.length;
  }

  private async select(where: SQL | undefined) {
    const rows = await this.db
      .select()
      .from(requestLog)
      .where(where)
      .orderBy(asc(requestLog.at), asc(requestLog.id));
    return rows.map(toEntry);
  }
}
