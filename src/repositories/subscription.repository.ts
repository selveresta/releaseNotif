import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { repositories } from '../db/schema/repositories';
import { subscriptions, type SubscriptionRow } from '../db/schema/subscriptions';
import { DuplicateSubscriptionError } from '../shared/errors/app-error';

export type SubscriptionRecord = SubscriptionRow & {
  repositoryFullName?: string;
  repositoryOwner?: string;
  repositoryName?: string;
};

export function createSubscriptionRepository(db: AppDb) {
  return {
    async findByEmailAndRepositoryId(email: string, repositoryId: number): Promise<SubscriptionRow | null> {
      const rows = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.email, email), eq(subscriptions.repositoryId, repositoryId)))
        .orderBy(subscriptions.id)
        .limit(1);
      return rows[0] ?? null;
    },

    async findActiveOrPendingByEmailAndRepositoryId(email: string, repositoryId: number): Promise<SubscriptionRow | null> {
      const rows = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.email, email),
            eq(subscriptions.repositoryId, repositoryId),
            eq(subscriptions.status, 'active'),
          ),
        )
        .limit(1);

      if (rows[0]) {
        return rows[0];
      }

      const pendingRows = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.email, email),
            eq(subscriptions.repositoryId, repositoryId),
            eq(subscriptions.status, 'pending_confirmation'),
          ),
        )
        .limit(1);

      return pendingRows[0] ?? null;
    },

    async createPending(input: {
      email: string;
      repositoryId: number;
      confirmToken: string;
      unsubscribeToken: string;
    }): Promise<SubscriptionRow> {
      try {
        const rows = await db
          .insert(subscriptions)
          .values({
            email: input.email,
            repositoryId: input.repositoryId,
            status: 'pending_confirmation',
            confirmToken: input.confirmToken,
            unsubscribeToken: input.unsubscribeToken,
            updatedAt: new Date(),
          })
          .returning();
        return rows[0]!;
      } catch (error) {
        if (error instanceof Error && (error as { code?: string }).code === '23505') {
          throw new DuplicateSubscriptionError();
        }

        throw error;
      }
    },

    async deleteById(id: number): Promise<void> {
      await db.delete(subscriptions).where(eq(subscriptions.id, id));
    },

    async findByConfirmToken(token: string): Promise<SubscriptionRow | null> {
      const rows = await db.select().from(subscriptions).where(eq(subscriptions.confirmToken, token)).limit(1);
      return rows[0] ?? null;
    },

    async activatePendingByConfirmToken(token: string): Promise<SubscriptionRow | null> {
      const rows = await db
        .update(subscriptions)
        .set({
          status: 'active',
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(subscriptions.confirmToken, token), eq(subscriptions.status, 'pending_confirmation')))
        .returning();
      return rows[0] ?? null;
    },

    async findByUnsubscribeToken(token: string): Promise<SubscriptionRow | null> {
      const rows = await db.select().from(subscriptions).where(eq(subscriptions.unsubscribeToken, token)).limit(1);
      return rows[0] ?? null;
    },

    async unsubscribeActiveByToken(token: string): Promise<SubscriptionRow | null> {
      const rows = await db
        .update(subscriptions)
        .set({
          status: 'unsubscribed',
          unsubscribedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(subscriptions.unsubscribeToken, token), eq(subscriptions.status, 'active')))
        .returning();
      return rows[0] ?? null;
    },

    async listActiveByEmail(email: string) {
      return db
        .select({
          email: subscriptions.email,
          repositoryId: subscriptions.repositoryId,
          status: subscriptions.status,
          createdAt: subscriptions.createdAt,
          repository: repositories.fullName,
        })
        .from(subscriptions)
        .innerJoin(repositories, eq(subscriptions.repositoryId, repositories.id))
        .where(and(eq(subscriptions.email, email), eq(subscriptions.status, 'active')))
        .orderBy(subscriptions.createdAt);
    },

    async listActiveByRepositoryId(repositoryId: number) {
      return db
        .select({
          id: subscriptions.id,
          email: subscriptions.email,
          repositoryId: subscriptions.repositoryId,
          status: subscriptions.status,
          confirmToken: subscriptions.confirmToken,
          unsubscribeToken: subscriptions.unsubscribeToken,
          createdAt: subscriptions.createdAt,
          repositoryFullName: repositories.fullName,
          repositoryOwner: repositories.owner,
          repositoryName: repositories.name,
        })
        .from(subscriptions)
        .innerJoin(repositories, eq(subscriptions.repositoryId, repositories.id))
        .where(and(eq(subscriptions.repositoryId, repositoryId), eq(subscriptions.status, 'active')))
        .orderBy(subscriptions.createdAt);
    },
  };
}

export type SubscriptionRepository = ReturnType<typeof createSubscriptionRepository>;
