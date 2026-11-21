import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Office-wide settings of the app, one row per key (today only `logo`).
 * `value` is JSON, so a new setting needs no migration.
 */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
