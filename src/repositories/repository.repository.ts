import { and, asc, eq, exists } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { repositories, type RepositoryRow } from '../db/schema/repositories';
import { subscriptions } from '../db/schema/subscriptions';
import { DuplicateRepositoryError } from '../shared/errors/app-error';

export type RepositoryRecord = RepositoryRow;

export function createRepositoryRepository(db: AppDb) {
  async function findByFullName(fullName: string): Promise<RepositoryRecord | null> {
    const rows = await db.select().from(repositories).where(eq(repositories.fullName, fullName)).limit(1);
    return rows[0] ?? null;
  }

  async function create(input: { owner: string; name: string; fullName: string }): Promise<RepositoryRecord> {
    try {
      const rows = await db
        .insert(repositories)
        .values({
          owner: input.owner,
          name: input.name,
          fullName: input.fullName,
          updatedAt: new Date(),
        })
        .returning();

      return rows[0]!;
    } catch (error) {
      if (error instanceof Error && (error as { code?: string }).code === '23505') {
        throw new DuplicateRepositoryError();
      }

      throw error;
    }
  }

  async function getOrCreate(input: { owner: string; name: string; fullName: string }): Promise<RepositoryRecord> {
    const existing = await findByFullName(input.fullName);
    if (existing) {
      return existing;
    }

    try {
      return await create(input);
    } catch (error) {
      if (error instanceof DuplicateRepositoryError) {
        const reloaded = await findByFullName(input.fullName);
        if (reloaded) {
          return reloaded;
        }
      }

      throw error;
    }
  }

  async function listWithActiveSubscriptions(): Promise<RepositoryRecord[]> {
    return db
      .select({
        id: repositories.id,
        owner: repositories.owner,
        name: repositories.name,
        fullName: repositories.fullName,
        lastSeenTag: repositories.lastSeenTag,
        lastCheckedAt: repositories.lastCheckedAt,
        createdAt: repositories.createdAt,
        updatedAt: repositories.updatedAt,
      })
      .from(repositories)
      .where(
        exists(
          db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.repositoryId, repositories.id),
                eq(subscriptions.status, 'active'),
              ),
            ),
        ),
      )
      .orderBy(asc(repositories.id));
  }

  async function updateScanState(input: {
    repositoryId: number;
    lastSeenTag?: string | null;
    lastCheckedAt: Date;
  }): Promise<void> {
    await db
      .update(repositories)
      .set({
        lastSeenTag: input.lastSeenTag === undefined ? undefined : input.lastSeenTag,
        lastCheckedAt: input.lastCheckedAt,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, input.repositoryId));
  }

  async function touchLastCheckedAt(repositoryId: number, lastCheckedAt: Date): Promise<void> {
    await db
      .update(repositories)
      .set({ lastCheckedAt, updatedAt: new Date() })
      .where(eq(repositories.id, repositoryId));
  }

  return {
    findByFullName,
    create,
    getOrCreate,
    listWithActiveSubscriptions,
    updateScanState,
    touchLastCheckedAt,
  };
}

export type RepositoryRepository = ReturnType<typeof createRepositoryRepository>;
