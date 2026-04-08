import type { AppEnv } from '../../config/env';
import { GithubExternalApiError, GithubRateLimitError, GithubRepositoryNotFoundError } from './github.errors';
import type { GitHubRelease, GitHubRepository } from './github.types';
import type { AppMetrics } from '../../infrastructure/metrics/metrics';

type FetchLike = typeof fetch;

export function createGitHubClient(
  env: Pick<AppEnv, 'GITHUB_API_BASE_URL' | 'GITHUB_TOKEN'>,
  metrics: AppMetrics,
  fetchImpl: FetchLike = fetch,
) {
  const baseUrl = env.GITHUB_API_BASE_URL.replace(/\/+$/, '');
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
  };

  async function request<T>(path: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers ?? {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      metrics.recordGithubRequest({ endpoint, status: 0, cached: false });
      throw new GithubExternalApiError('GitHub API request failed due to network error.');
    }

    metrics.recordGithubRequest({ endpoint, status: response.status, cached: false });
    if (response.status === 429) {
      throw new GithubRateLimitError();
    }

    if (response.status === 404) {
      throw new GithubRepositoryNotFoundError();
    }

    if (!response.ok) {
      throw new GithubExternalApiError(`GitHub API request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  return {
    async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
      return request<GitHubRepository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, 'repo');
    },

    async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
      const url = `${baseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers,
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        metrics.recordGithubRequest({ endpoint: 'latest_release', status: 0, cached: false });
        throw new GithubExternalApiError('GitHub API request failed due to network error.');
      }

      metrics.recordGithubRequest({ endpoint: 'latest_release', status: response.status, cached: false });
      if (response.status === 429) {
        throw new GithubRateLimitError();
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new GithubExternalApiError(`GitHub API request failed with status ${response.status}.`);
      }

      return (await response.json()) as GitHubRelease;
    },
  };
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
