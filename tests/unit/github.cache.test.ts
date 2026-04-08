import { describe, expect, it, vi } from 'vitest';
import { createGitHubClient } from '../../src/integrations/github/github.client';
import { createCachedGitHubClient } from '../../src/integrations/github/github.cached-client';

describe('github cache layer', () => {
  it('cache hit avoids base repository request', async () => {
    const base = {
      getRepository: vi.fn(),
      getLatestRelease: vi.fn(),
    } as any;
    const cache = {
      getRepositoryExists: vi.fn().mockResolvedValue(true),
      setRepositoryExists: vi.fn(),
      getLatestRelease: vi.fn(),
      setLatestRelease: vi.fn(),
    } as any;
    const metrics = {
      recordGithubRequest: vi.fn(),
    } as any;

    const client = createCachedGitHubClient(base, cache, metrics);
    const result = await client.getRepository('golang', 'go');

    expect(result.full_name).toBe('golang/go');
    expect(base.getRepository).not.toHaveBeenCalled();
    expect(metrics.recordGithubRequest).toHaveBeenCalledWith({ endpoint: 'repo', status: 200, cached: true });
  });

  it('cache miss stores latest release result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ tag_name: 'v1.0.0', html_url: 'https://example.com' }),
    });
    const baseMetrics = {
      recordGithubRequest: vi.fn(),
    } as any;
    const base = createGitHubClient({ GITHUB_API_BASE_URL: 'https://api.github.com', GITHUB_TOKEN: undefined }, baseMetrics, fetchImpl as any);
    const cache = {
      getRepositoryExists: vi.fn(),
      setRepositoryExists: vi.fn(),
      getLatestRelease: vi.fn().mockResolvedValue(undefined),
      setLatestRelease: vi.fn(),
    } as any;
    const metrics = {
      recordGithubRequest: vi.fn(),
    } as any;

    const client = createCachedGitHubClient(base, cache, metrics);
    const release = await client.getLatestRelease('golang', 'go');

    expect(release?.tag_name).toBe('v1.0.0');
    expect(cache.setLatestRelease).toHaveBeenCalledWith('golang', 'go', release);
    expect(baseMetrics.recordGithubRequest).toHaveBeenCalledWith({ endpoint: 'latest_release', status: 200, cached: false });
  });

  it('fallback works when cache layer fails', async () => {
    const base = {
      getRepository: vi.fn().mockResolvedValue({ full_name: 'golang/go', html_url: 'https://github.com/golang/go' }),
      getLatestRelease: vi.fn().mockResolvedValue(null),
    } as any;
    const cache = {
      getRepositoryExists: vi.fn().mockRejectedValue(new Error('redis down')),
      setRepositoryExists: vi.fn(),
      getLatestRelease: vi.fn().mockRejectedValue(new Error('redis down')),
      setLatestRelease: vi.fn(),
    } as any;
    const metrics = {
      recordGithubRequest: vi.fn(),
    } as any;

    const client = createCachedGitHubClient(base, cache, metrics);

    await expect(client.getRepository('golang', 'go')).resolves.toMatchObject({ full_name: 'golang/go' });
    await expect(client.getLatestRelease('golang', 'go')).resolves.toBeNull();
  });

  it('cache hit for latest release records cached metric', async () => {
    const base = {
      getRepository: vi.fn(),
      getLatestRelease: vi.fn(),
    } as any;
    const cache = {
      getRepositoryExists: vi.fn(),
      setRepositoryExists: vi.fn(),
      getLatestRelease: vi.fn().mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' }),
      setLatestRelease: vi.fn(),
    } as any;
    const metrics = {
      recordGithubRequest: vi.fn(),
    } as any;

    const client = createCachedGitHubClient(base, cache, metrics);
    const release = await client.getLatestRelease('golang', 'go');

    expect(release?.tag_name).toBe('v2.0.0');
    expect(metrics.recordGithubRequest).toHaveBeenCalledWith({ endpoint: 'latest_release', status: 200, cached: true });
  });
});
