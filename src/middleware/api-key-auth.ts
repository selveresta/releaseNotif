import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../shared/errors/app-error';

export function createApiKeyAuthMiddleware(apiKey: string) {
  return function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
    const providedKey = req.header('x-api-key');

    if (!providedKey || providedKey !== apiKey) {
      next(new UnauthorizedError('Missing or invalid API key.'));
      return;
    }

    next();
  };
}
