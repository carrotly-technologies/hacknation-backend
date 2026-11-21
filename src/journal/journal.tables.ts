import { date, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { ObservationKind } from '../cases/case.types.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
};

export const journalNotes = pgTable(
  'journal_notes',
  {
    id: text().primaryKey(),
    personId: text('person_id').notNull(),
    authorId: text('author_id').notNull(),
    text: text().notNull(),
    ...timestamps,
  },
  (t) => [index('journal_notes_person_author_idx').on(t.personId, t.authorId)],
);

export const journalObservations = pgTable(
  'journal_observations',
  {
    id: text().primaryKey(),
    personId: text('person_id').notNull(),
    authorId: text('author_id').notNull(),
    date: date({ mode: 'string' }).notNull(),
    criterionId: text('criterion_id').notNull(),
    indicatorId: text('indicator_id'),
    kind: text().$type<ObservationKind>().notNull(),
    situation: text().notNull(),
    action: text().notNull(),
    result: text().notNull(),
    ...timestamps,
  },
  (t) => [
    index('journal_observations_person_author_idx').on(t.personId, t.authorId),
  ],
);
