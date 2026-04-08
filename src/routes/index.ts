import { Router } from 'express';
import type { SubscriptionsController } from '../controllers/subscriptions.controller';
import { createSubscriptionsRouter } from './subscriptions.routes';

export function createRoutes(controller: SubscriptionsController) {
  const router = Router();
  router.use('/', createSubscriptionsRouter(controller));
  return router;
}
