import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { AppEnv } from '../config/env';
import * as notificationDeliverySchema from './schema/notification-deliveries';
import * as repositorySchema from './schema/repositories';
import * as subscriptionSchema from './schema/subscriptions';

export function createPool(databaseUrl: string) {
  return new Pool({ connectionString: databaseUrl });
}

export function createDb(pool: Pool) {
  return drizzle(pool, {
    schema: {
      ...repositorySchema,
      ...notificationDeliverySchema,
      ...subscriptionSchema,
    },
  });
}

export type AppDb = ReturnType<typeof createDb>;

export async function closePool(pool: Pool) {
  await pool.end();
}

export function createPoolFromEnv(env: Pick<AppEnv, 'DATABASE_URL'>) {
  return createPool(env.DATABASE_URL);
}
