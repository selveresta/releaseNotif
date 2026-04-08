import type { RedisLikeClient } from '../../infrastructure/redis/redis.client';
import type { GitHubRelease } from './github.types';

const CACHE_TTL_SECONDS = 600;

type CacheValue<T> = {
  value: T | null;
};

function repoKey(owner: string, repo: string) {
  return `github:repo:${owner}/${repo}:exists`;
}

function releaseKey(owner: string, repo: string) {
  return `github:repo:${owner}/${repo}:latest_release`;
}

export function createGithubCache(redis: RedisLikeClient | null) {
  async function read<T>(key: string): Promise<CacheValue<T> | null> {
    if (!redis) {
      return null;
    }

    const raw = await redis.get(key);
    if (raw === null) {
      return null;
    }

      return JSON.parse(raw) as CacheValue<T>;
  }

  async function write<T>(key: string, value: CacheValue<T>) {
    if (!redis) {
      return;
    }

      await redis.set(key, JSON.stringify(value), { EX: CACHE_TTL_SECONDS });
  }

  return {
    async getRepositoryExists(owner: string, repo: string): Promise<boolean | null> {
      const cached = await read<boolean>(repoKey(owner, repo));
      if (!cached) {
        return null;
      }

      return cached.value;
    },

    async setRepositoryExists(owner: string, repo: string, exists: boolean) {
      await write<boolean>(repoKey(owner, repo), { value: exists });
    },

    async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | undefined | null> {
      const cached = await read<GitHubRelease>(releaseKey(owner, repo));
      if (!cached) {
        return undefined;
      }

      return cached.value;
    },

    async setLatestRelease(owner: string, repo: string, release: GitHubRelease | null) {
      await write<GitHubRelease>(releaseKey(owner, repo), { value: release });
    },
  };
}

export type GithubCache = ReturnType<typeof createGithubCache>;
