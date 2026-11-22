import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { AuditActorRole, AuditResult } from './audit.types.js';

/**
 * Append-only event log. The migration adds a trigger that refuses UPDATE,
 * DELETE and TRUNCATE (drizzle/*_audit_log/migration.sql); the unique `seq`
 * and `prev_hash` keep the hash chain from forking.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text().primaryKey(),
    seq: integer().notNull(),
    at: timestamp({ withTimezone: true, precision: 3 }).notNull(),
    actorId: text('actor_id'),
    actorRole: text('actor_role').$type<AuditActorRole>(),
    action: text().notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    changedFields: text('changed_fields').array().notNull(),
    ip: text(),
    result: text().$type<AuditResult>().notNull(),
    prevHash: text('prev_hash').notNull(),
    hash: text().notNull(),
  },
  (t) => [
    uniqueIndex('audit_log_seq_idx').on(t.seq),
    uniqueIndex('audit_log_prev_hash_idx').on(t.prevHash),
    index('audit_log_at_idx').on(t.at),
    index('audit_log_actor_idx').on(t.actorId),
  ],
);
