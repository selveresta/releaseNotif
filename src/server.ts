import dotenv from 'dotenv';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createDb, createPoolFromEnv, closePool } from './db/client';
import { runMigrations } from './db/migrate';
import { createGitHubClient } from './integrations/github/github.client';
import { createGithubCache } from './integrations/github/github.cache';
import { createCachedGitHubClient } from './integrations/github/github.cached-client';
import { createNotifier } from './notifier/notifier.service';
import { createRepositoryRepository } from './repositories/repository.repository';
import { createSubscriptionRepository } from './repositories/subscription.repository';
import { createNotificationDeliveryRepository } from './repositories/notification-delivery.repository';
import { createSubscriptionsController } from './controllers/subscriptions.controller';
import { createHtmlController } from './controllers/html.controller';
import { createSubscriptionService } from './services/subscription.service';
import { createScannerService } from './services/scanner.service';
import { createLogger } from './shared/utils/logger';
import { startScannerScheduler } from './scanner/scheduler';
import { createMetrics } from './infrastructure/metrics/metrics';
import { createRedisConnection } from './infrastructure/redis/redis.client';
import { createGrpcServer } from './grpc/grpc.server';

async function main() {
  dotenv.config();
  const env = loadEnv();
  const logger = createLogger(env);
  const metrics = createMetrics(env.ENABLE_METRICS !== 'false');
  const pool = createPoolFromEnv(env);
  const db = createDb(pool);

  await runMigrations(db);

  const redis = await createRedisConnection(env);
  const githubBase = createGitHubClient(env, metrics);
  const githubCache = createGithubCache(redis.client);
  const github = createCachedGitHubClient(githubBase, githubCache, metrics);
  const notifier = createNotifier(env, metrics);
  const repositoryRepository = createRepositoryRepository(db);
  const subscriptionRepository = createSubscriptionRepository(db);
  const notificationDeliveryRepository = createNotificationDeliveryRepository(db);
  const subscriptionService = createSubscriptionService({
    repositories: repositoryRepository,
    subscriptions: subscriptionRepository,
    github,
    notifier,
  });
  const scannerService = createScannerService({
    repositories: repositoryRepository,
    subscriptions: subscriptionRepository,
    notificationDeliveries: notificationDeliveryRepository,
    github,
    notifier,
    logger,
    metrics,
  });
  const subscriptionsController = createSubscriptionsController(subscriptionService);
  const htmlController = createHtmlController(subscriptionService);
  const app = createApp({
    subscriptionsController,
    htmlController,
    apiKey: env.API_KEY,
    metrics,
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`Server started on port ${env.PORT}.`);
  });

  const scheduler = startScannerScheduler(scannerService, env.SCANNER_CRON, metrics);

  let grpcServer: ReturnType<typeof createGrpcServer> | null = null;
  if (env.ENABLE_GRPC !== 'false') {
    grpcServer = createGrpcServer(subscriptionService, metrics);
    await grpcServer.start(env.GRPC_PORT);
    logger.info(`gRPC server started on port ${env.GRPC_PORT}.`);
  }

  const shutdown = async () => {
    scheduler.stop();
    if (grpcServer) {
      await grpcServer.stop();
    }
    await redis.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await closePool(pool);
  };

  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
