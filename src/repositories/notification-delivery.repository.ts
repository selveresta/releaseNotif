import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { notificationDeliveries, type NotificationDeliveryRow } from '../db/schema/notification-deliveries';

export function createNotificationDeliveryRepository(db: AppDb) {
  return {
    async findBySubscriptionAndTag(subscriptionId: number, tag: string): Promise<NotificationDeliveryRow | null> {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(and(eq(notificationDeliveries.subscriptionId, subscriptionId), eq(notificationDeliveries.tag, tag)))
        .limit(1);
      return rows[0] ?? null;
    },

    async createDelivery(input: {
      repositoryId: number;
      subscriptionId: number;
      tag: string;
      status: 'sent' | 'failed';
      sentAt?: Date | null;
    }): Promise<NotificationDeliveryRow> {
      const rows = await db
        .insert(notificationDeliveries)
        .values({
          repositoryId: input.repositoryId,
          subscriptionId: input.subscriptionId,
          tag: input.tag,
          status: input.status,
          sentAt: input.sentAt ?? null,
          createdAt: new Date(),
        })
        .returning();
      return rows[0]!;
    },

    async updateDeliveryStatus(id: number, input: { status: 'sent' | 'failed'; sentAt?: Date | null }): Promise<void> {
      await db
        .update(notificationDeliveries)
        .set({
          status: input.status,
          sentAt: input.sentAt ?? null,
        })
        .where(eq(notificationDeliveries.id, id));
    },
  };
}

export type NotificationDeliveryRepository = ReturnType<typeof createNotificationDeliveryRepository>;
