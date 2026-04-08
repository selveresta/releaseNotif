import type { GitHubClient } from './github.client';
import { GithubRepositoryNotFoundError } from './github.errors';
import type { GithubCache } from './github.cache';
import type { AppMetrics } from '../../infrastructure/metrics/metrics';
import type { GitHubRelease, GitHubRepository } from './github.types';

export function createCachedGitHubClient(base: GitHubClient, cache: GithubCache, metrics?: AppMetrics) {
  return {
    async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
      let cached: boolean | null = null;
      try {
        cached = await cache.getRepositoryExists(owner, repo);
      } catch {
        // Fall through to the base client on cache errors.
      }

      if (cached === false) {
        metrics?.recordGithubRequest({ endpoint: 'repo', status: 404, cached: true });
        throw new GithubRepositoryNotFoundError();
      }

      if (cached === true) {
        metrics?.recordGithubRequest({ endpoint: 'repo', status: 200, cached: true });
        return {
          full_name: `${owner}/${repo}`,
          html_url: `https://github.com/${owner}/${repo}`,
        };
      }

      const repository = await base.getRepository(owner, repo);
      try {
        await cache.setRepositoryExists(owner, repo, true);
      } catch {
        // Ignore cache write failures.
      }

      return repository;
    },

    async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
      try {
        const cached = await cache.getLatestRelease(owner, repo);
        if (cached !== undefined) {
          metrics?.recordGithubRequest({
            endpoint: 'latest_release',
            status: cached === null ? 404 : 200,
            cached: true,
          });
          return cached;
        }
      } catch {
        // Fall through to the base client on cache errors.
      }

      const release = await base.getLatestRelease(owner, repo);
      try {
        await cache.setLatestRelease(owner, repo, release);
      } catch {
        // Ignore cache write failures.
      }

      return release;
    },
  };
}

export type CachedGitHubClient = ReturnType<typeof createCachedGitHubClient>;
