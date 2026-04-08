import type { Request, Response, NextFunction } from 'express';
import { emailQuerySchema, subscribeRequestSchema, tokenParamSchema } from '../shared/validation/schemas';
import { ValidationError } from '../shared/errors/app-error';
import type { SubscriptionService } from '../services/subscription.service';

export function createSubscriptionsController(service: SubscriptionService) {
  return {
    async subscribe(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = subscribeRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError('Invalid request body.');
        }

        const result = await service.subscribe(parsed.data);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },

    async confirm(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = tokenParamSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError('Invalid token.');
        }

        const result = await service.confirm(parsed.data.token);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    async unsubscribe(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = tokenParamSchema.safeParse(req.params);
        if (!parsed.success) {
          throw new ValidationError('Invalid token.');
        }

        const result = await service.unsubscribe(parsed.data.token);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },

    async listByEmail(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = emailQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          throw new ValidationError('Invalid email query parameter.');
        }

        const result = await service.getSubscriptionsByEmail(parsed.data.email);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}

export type SubscriptionsController = ReturnType<typeof createSubscriptionsController>;
