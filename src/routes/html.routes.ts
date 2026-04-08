import { Router } from 'express';
import type { HtmlController } from '../controllers/html.controller';

export function createHtmlRouter(controller: HtmlController) {
  const router = Router();
  router.get('/', controller.page);
  router.post('/subscribe', controller.submit);
  return router;
}
