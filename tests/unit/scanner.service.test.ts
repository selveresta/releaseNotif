import { describe, expect, it, vi } from 'vitest';
import { createScannerService } from '../../src/services/scanner.service';
import { GitHubRateLimitError } from '../../src/shared/errors/app-error';

function makeScannerService() {
  const deliveryKeys = new Set<string>();
  const repositories = {
    listWithActiveSubscriptions: vi.fn(),
    touchLastCheckedAt: vi.fn(),
    updateScanState: vi.fn(),
  } as any;
  const subscriptions = {
    listActiveByRepositoryId: vi.fn(),
  } as any;
  const notificationDeliveries = {
    findBySubscriptionAndTag: vi.fn((subscriptionId: number, tag: string) => {
      const key = `${subscriptionId}:${tag}`;
      return deliveryKeys.has(key) ? { id: deliveryKeys.size, subscriptionId, tag, status: 'sent' } : null;
    }),
    createDelivery: vi.fn((input: { subscriptionId: number; tag: string }) => {
      const key = `${input.subscriptionId}:${input.tag}`;
      deliveryKeys.add(key);
      return Promise.resolve({ id: deliveryKeys.size, subscriptionId: input.subscriptionId, tag: input.tag });
    }),
    updateDeliveryStatus: vi.fn(),
  } as any;
  const github = {
    getLatestRelease: vi.fn(),
  } as any;
  const notifier = {
    sendReleaseNotificationEmail: vi.fn(),
  } as any;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const metrics = {
    recordScannerFailure: vi.fn(),
  } as any;
  const service = createScannerService({ repositories, subscriptions, notificationDeliveries, github, notifier, logger, metrics });
  return { service, repositories, subscriptions, notificationDeliveries, github, notifier, logger, metrics };
}

describe('scanner service', () => {
  it('no release => no email', async () => {
    const { service, repositories, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue(null);

    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('no tag change => no email', async () => {
    const { service, repositories, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v1.0.0', html_url: 'https://example.com' });

    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).not.toHaveBeenCalled();
  });

  it('first seen release initializes baseline only', async () => {
    const { service, repositories, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: null },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v1.0.0', html_url: 'https://example.com' });

    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).not.toHaveBeenCalled();
    expect(repositories.updateScanState).toHaveBeenCalledWith({
      repositoryId: 1,
      lastSeenTag: 'v1.0.0',
      lastCheckedAt: expect.any(Date),
    });
  });

  it('new tag sends emails', async () => {
    const { service, repositories, subscriptions, notificationDeliveries, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' });
    subscriptions.listActiveByRepositoryId.mockResolvedValue([
      { id: 10, email: 'user@example.com', unsubscribeToken: 'u1' },
    ]);
    notifier.sendReleaseNotificationEmail.mockResolvedValue(undefined);

    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).toHaveBeenCalledTimes(1);
    expect(notificationDeliveries.createDelivery).toHaveBeenCalledWith({
      repositoryId: 1,
      subscriptionId: 10,
      tag: 'v2.0.0',
      status: 'failed',
      sentAt: null,
    });
    expect(notificationDeliveries.updateDeliveryStatus).toHaveBeenCalledWith(1, {
      status: 'sent',
      sentAt: expect.any(Date),
    });
  });

  it('one email failure does not stop other subscribers', async () => {
    const { service, repositories, subscriptions, notificationDeliveries, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' });
    subscriptions.listActiveByRepositoryId.mockResolvedValue([
      { id: 11, email: 'first@example.com', unsubscribeToken: 'u1' },
      { id: 12, email: 'second@example.com', unsubscribeToken: 'u2' },
    ]);
    notifier.sendReleaseNotificationEmail
      .mockRejectedValueOnce(new Error('smtp failed'))
      .mockResolvedValueOnce(undefined);

    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).toHaveBeenCalledTimes(2);
    expect(notificationDeliveries.createDelivery).toHaveBeenCalledTimes(2);
    expect(notificationDeliveries.updateDeliveryStatus).toHaveBeenCalledTimes(1);
    expect(repositories.updateScanState).toHaveBeenCalledWith({
      repositoryId: 1,
      lastSeenTag: 'v2.0.0',
      lastCheckedAt: expect.any(Date),
    });
  });

  it('last_seen_tag updates after successful processing', async () => {
    const { service, repositories, subscriptions, notificationDeliveries, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' });
    subscriptions.listActiveByRepositoryId.mockResolvedValue([
      { id: 10, email: 'user@example.com', unsubscribeToken: 'u1' },
    ]);
    notifier.sendReleaseNotificationEmail.mockResolvedValue(undefined);

    await service.runOnce();

    expect(repositories.updateScanState).toHaveBeenCalledWith({
      repositoryId: 1,
      lastSeenTag: 'v2.0.0',
      lastCheckedAt: expect.any(Date),
    });
  });

  it('second run same tag skips duplicate delivery records and emails', async () => {
    const { service, repositories, subscriptions, notificationDeliveries, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([{ id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' }]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' });
    subscriptions.listActiveByRepositoryId.mockResolvedValue([{ id: 10, email: 'first@example.com', unsubscribeToken: 'u1' }]);
    notifier.sendReleaseNotificationEmail.mockResolvedValue(undefined);

    await service.runOnce();
    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).toHaveBeenCalledTimes(1);
    expect(notificationDeliveries.createDelivery).toHaveBeenCalledTimes(1);
    expect(repositories.updateScanState).toHaveBeenCalledWith({
      repositoryId: 1,
      lastSeenTag: 'v2.0.0',
      lastCheckedAt: expect.any(Date),
    });
  });

  it('partial failure does not retry on next run and still advances last_seen_tag', async () => {
    const { service, repositories, subscriptions, notificationDeliveries, github, notifier } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockResolvedValue({ tag_name: 'v2.0.0', html_url: 'https://example.com' });
    subscriptions.listActiveByRepositoryId.mockResolvedValue([
      { id: 11, email: 'first@example.com', unsubscribeToken: 'u1' },
      { id: 12, email: 'second@example.com', unsubscribeToken: 'u2' },
    ]);
    notifier.sendReleaseNotificationEmail
      .mockRejectedValueOnce(new Error('smtp failed'))
      .mockResolvedValueOnce(undefined);

    await service.runOnce();
    await service.runOnce();

    expect(notifier.sendReleaseNotificationEmail).toHaveBeenCalledTimes(2);
    expect(notificationDeliveries.createDelivery).toHaveBeenCalledTimes(2);
    expect(repositories.updateScanState).toHaveBeenCalledWith({
      repositoryId: 1,
      lastSeenTag: 'v2.0.0',
      lastCheckedAt: expect.any(Date),
    });
    expect(notificationDeliveries.findBySubscriptionAndTag).toHaveBeenCalledWith(11, 'v2.0.0');
    expect(notificationDeliveries.findBySubscriptionAndTag).toHaveBeenCalledWith(12, 'v2.0.0');
    await service.runOnce();
    expect(notifier.sendReleaseNotificationEmail).toHaveBeenCalledTimes(2);
  });

  it('GitHub 429 does not crash whole job', async () => {
    const { service, repositories, github, logger, metrics } = makeScannerService();
    repositories.listWithActiveSubscriptions.mockResolvedValue([
      { id: 1, owner: 'golang', name: 'go', fullName: 'golang/go', lastSeenTag: 'v1.0.0' },
      { id: 2, owner: 'openai', name: 'codex', fullName: 'openai/codex', lastSeenTag: 'v1.0.0' },
    ]);
    github.getLatestRelease.mockRejectedValueOnce(new GitHubRateLimitError());
    github.getLatestRelease.mockResolvedValueOnce(null);

    await service.runOnce();

    expect(logger.warn).toHaveBeenCalled();
    expect(metrics.recordScannerFailure).toHaveBeenCalled();
  });
});
