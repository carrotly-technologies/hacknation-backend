import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { LogKind } from './monitor.types.js';

/** Activity log of the app (src/monitor): API calls and pageviews, no bodies. */
export const requestLog = pgTable(
  'request_log',
  {
    id: text().primaryKey(),
    at: timestamp({ withTimezone: true }).notNull(),
    sessionId: text('session_id'),
    kind: text().$type<LogKind>().notNull(),
    method: text(),
    path: text().notNull(),
    status: integer(),
    durationMs: integer('duration_ms'),
    ip: text(),
    userAgent: text('user_agent'),
    userId: text('user_id'),
    userName: text('user_name'),
  },
  (t) => [
    index('request_log_at_idx').on(t.at),
    index('request_log_session_idx').on(t.sessionId, t.at),
  ],
);
