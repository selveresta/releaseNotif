import { createClient } from 'redis';
import type { AppEnv } from '../../config/env';

export type RedisLikeClient = {
  connect(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<string>;
  quit(): Promise<string>;
  removeAllListeners(): void;
};

export type RedisConnection = {
  client: RedisLikeClient | null;
  available: boolean;
  close: () => Promise<void>;
};

export async function createRedisConnection(env: Pick<AppEnv, 'REDIS_URL'>): Promise<RedisConnection> {
  const client = createClient({ url: env.REDIS_URL }) as unknown as RedisLikeClient;
  try {
    await client.connect();
    return {
      client,
      available: true,
      close: async () => {
        await client.quit();
      },
    };
  } catch {
    client.removeAllListeners();
    return {
      client: null,
      available: false,
      close: async () => undefined,
    };
  }
}
