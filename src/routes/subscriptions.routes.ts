import { Router } from 'express';
import type { SubscriptionsController } from '../controllers/subscriptions.controller';

export function createSubscriptionsRouter(controller: SubscriptionsController) {
  const router = Router();

  router.post('/subscribe', controller.subscribe);
  router.get('/confirm/:token', controller.confirm);
  router.get('/unsubscribe/:token', controller.unsubscribe);
  router.get('/subscriptions', controller.listByEmail);

  return router;
}
