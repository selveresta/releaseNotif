import express from 'express';
import type { SubscriptionsController } from './controllers/subscriptions.controller';
import type { HtmlController } from './controllers/html.controller';
import { createHtmlRouter } from './routes/html.routes';
import { errorHandler } from './middleware/error-handler';
import { createApiKeyAuthMiddleware } from './middleware/api-key-auth';
import type { AppMetrics } from './infrastructure/metrics/metrics';

export function createApp(input: {
  subscriptionsController: SubscriptionsController;
  htmlController: HtmlController;
  apiKey: string;
  metrics: AppMetrics;
}) {
  const app = express();
  const authMiddleware = createApiKeyAuthMiddleware(input.apiKey);

  app.use(input.metrics.httpMiddleware);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/', createHtmlRouter(input.htmlController));
  app.post('/api/subscribe', authMiddleware, input.subscriptionsController.subscribe);
  app.get('/api/confirm/:token', input.subscriptionsController.confirm);
  app.get('/api/unsubscribe/:token', input.subscriptionsController.unsubscribe);
  app.get('/api/subscriptions', authMiddleware, input.subscriptionsController.listByEmail);
  app.get('/metrics', async (_req, res, next) => {
    try {
      res.set('Content-Type', input.metrics.registry.contentType);
      res.status(200).send(await input.metrics.render());
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);

  return app;
}
