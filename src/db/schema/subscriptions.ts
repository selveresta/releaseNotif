import { index, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { repositories } from './repositories';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending_confirmation',
  'active',
  'unsubscribed',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    repositoryId: integer('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
    status: subscriptionStatusEnum('status').notNull(),
    confirmToken: text('confirm_token').notNull().unique(),
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('subscriptions_repository_id_idx').on(table.repositoryId),
    index('subscriptions_status_idx').on(table.status),
    // The partial unique index on email + repository_id is enforced in the hand-written SQL migration.
  ],
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type NewSubscriptionRow = typeof subscriptions.$inferInsert;
