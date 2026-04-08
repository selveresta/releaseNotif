import { index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { repositories } from './repositories';
import { subscriptions } from './subscriptions';

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', ['sent', 'failed']);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: serial('id').primaryKey(),
    repositoryId: integer('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
    subscriptionId: integer('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    status: notificationDeliveryStatusEnum('status').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_deliveries_subscription_id_tag_unique').on(table.subscriptionId, table.tag),
    index('notification_deliveries_repository_id_idx').on(table.repositoryId),
  ],
);

export type NotificationDeliveryRow = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDeliveryRow = typeof notificationDeliveries.$inferInsert;
