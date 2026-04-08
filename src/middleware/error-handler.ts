import type { NextFunction, Request, Response } from 'express';
import { AppError, InternalServerError, ValidationError } from '../shared/errors/app-error';

function isJsonParseError(error: unknown) {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const typedError = error as SyntaxError & { type?: string };
  return typedError.type === 'entity.parse.failed';
}

function toErrorResponse(error: Error | AppError) {
  if (error instanceof ValidationError) {
    return { error: 'Bad Request', message: error.message, statusCode: error.statusCode };
  }

  if (error instanceof AppError) {
    const titleByStatus: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      404: 'Not Found',
      409: 'Conflict',
      410: 'Gone',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };

    return {
      error: titleByStatus[error.statusCode] ?? 'Error',
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  return {
    error: 'Internal Server Error',
    message: 'Internal server error.',
    statusCode: 500,
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isJsonParseError(error)) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON body.',
    });
    return;
  }

  const normalized = error instanceof Error ? error : new InternalServerError();
  const payload = toErrorResponse(normalized as Error | AppError);

  res.status(payload.statusCode).json({
    error: payload.error,
    message: payload.message,
  });
}
