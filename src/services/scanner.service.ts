import type { GitHubClient } from '../integrations/github/github.client';
import type { NotifierService } from '../notifier/notifier.service';
import type { RepositoryRepository } from '../repositories/repository.repository';
import type { NotificationDeliveryRepository } from '../repositories/notification-delivery.repository';
import type { SubscriptionRepository } from '../repositories/subscription.repository';
import { GitHubRateLimitError } from '../shared/errors/app-error';
import type { AppMetrics } from '../infrastructure/metrics/metrics';

export function createScannerService(deps: {
  repositories: RepositoryRepository;
  subscriptions: SubscriptionRepository;
  notificationDeliveries: NotificationDeliveryRepository;
  github: GitHubClient;
  notifier: NotifierService;
  logger: {
    info(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    error(message: string, meta?: unknown): void;
  };
  metrics: AppMetrics;
}) {
  return {
    async runOnce() {
      const repositories = await deps.repositories.listWithActiveSubscriptions();

      for (const repository of repositories) {
        try {
          const latestRelease = await deps.github.getLatestRelease(repository.owner, repository.name);
          const now = new Date();

          if (!latestRelease) {
            await deps.repositories.touchLastCheckedAt(repository.id, now);
            continue;
          }

          if (!repository.lastSeenTag) {
            await deps.repositories.updateScanState({
              repositoryId: repository.id,
              lastSeenTag: latestRelease.tag_name,
              lastCheckedAt: now,
            });
            continue;
          }

          if (repository.lastSeenTag === latestRelease.tag_name) {
            await deps.repositories.touchLastCheckedAt(repository.id, now);
            continue;
          }

          const subscriptions = await deps.subscriptions.listActiveByRepositoryId(repository.id);
          let successCount = 0;
          let failureCount = 0;

          for (const subscription of subscriptions) {
            const existingDelivery = await deps.notificationDeliveries.findBySubscriptionAndTag(subscription.id, latestRelease.tag_name);
            if (existingDelivery) {
              continue;
            }

            try {
              const delivery = await deps.notificationDeliveries.createDelivery({
                repositoryId: repository.id,
                subscriptionId: subscription.id,
                tag: latestRelease.tag_name,
                status: 'failed',
                sentAt: null,
              });
              await deps.notifier.sendReleaseNotificationEmail({
                email: subscription.email,
                repositoryFullName: repository.fullName,
                releaseTag: latestRelease.tag_name,
                releaseUrl: latestRelease.html_url,
                unsubscribeToken: subscription.unsubscribeToken,
              });
              await deps.notificationDeliveries.updateDeliveryStatus(delivery.id, {
                status: 'sent',
                sentAt: new Date(),
              });
              successCount += 1;
            } catch (error) {
              failureCount += 1;
              deps.logger.error('Failed to deliver release notification.', {
                repository: repository.fullName,
                email: subscription.email,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (failureCount > 0) {
            deps.logger.warn('Partial notification failure for repository.', {
              repository: repository.fullName,
              releaseTag: latestRelease.tag_name,
              successCount,
              failureCount,
            });
          }

          await deps.repositories.updateScanState({
            repositoryId: repository.id,
            lastSeenTag: latestRelease.tag_name,
            lastCheckedAt: now,
          });
        } catch (error) {
          if (error instanceof GitHubRateLimitError) {
            deps.metrics.recordScannerFailure();
            deps.logger.warn('GitHub rate limit hit during scanner run.', {
              repository: repository.fullName,
              error: error.message,
            });
            continue;
          }

          deps.metrics.recordScannerFailure();
          deps.logger.error('Scanner failed for repository.', {
            repository: repository.fullName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  };
}

export type ScannerService = ReturnType<typeof createScannerService>;
