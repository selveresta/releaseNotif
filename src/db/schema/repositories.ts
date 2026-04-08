import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const repositories = pgTable(
  'repositories',
  {
    id: serial('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull().unique(),
    lastSeenTag: text('last_seen_tag'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);
export type RepositoryRow = typeof repositories.$inferSelect;
export type NewRepositoryRow = typeof repositories.$inferInsert;
