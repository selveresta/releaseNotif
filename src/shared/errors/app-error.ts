export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_REPOSITORY_FORMAT'
  | 'REPOSITORY_NOT_FOUND'
  | 'SUBSCRIPTION_ALREADY_EXISTS'
  | 'TOKEN_NOT_FOUND'
  | 'TOKEN_ALREADY_USED'
  | 'UNAUTHORIZED'
  | 'GITHUB_RATE_LIMIT'
  | 'EXTERNAL_API_FAILURE'
  | 'EMAIL_DELIVERY_FAILURE'
  | 'DUPLICATE_SUBSCRIPTION'
  | 'DUPLICATE_REPOSITORY'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class InvalidRepositoryFormatError extends AppError {
  constructor() {
    super('INVALID_REPOSITORY_FORMAT', 'Repository format must be owner/repo.', 400);
    this.name = 'InvalidRepositoryFormatError';
  }
}

export class RepositoryNotFoundError extends AppError {
  constructor() {
    super('REPOSITORY_NOT_FOUND', 'GitHub repository not found.', 404);
    this.name = 'RepositoryNotFoundError';
  }
}

export class SubscriptionAlreadyExistsError extends AppError {
  constructor() {
    super('SUBSCRIPTION_ALREADY_EXISTS', 'Subscription already exists for this email and repository.', 409);
    this.name = 'SubscriptionAlreadyExistsError';
  }
}

export class TokenNotFoundError extends AppError {
  constructor(message: string) {
    super('TOKEN_NOT_FOUND', message, 404);
    this.name = 'TokenNotFoundError';
  }
}

export class TokenAlreadyUsedError extends AppError {
  constructor(message: string) {
    super('TOKEN_ALREADY_USED', message, 410);
    this.name = 'TokenAlreadyUsedError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized.') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class GitHubRateLimitError extends AppError {
  constructor() {
    super('GITHUB_RATE_LIMIT', 'GitHub API rate limit exceeded.', 429);
    this.name = 'GitHubRateLimitError';
  }
}

export class ExternalApiFailureError extends AppError {
  constructor(message = 'External service failure.') {
    super('EXTERNAL_API_FAILURE', message, 500);
    this.name = 'ExternalApiFailureError';
  }
}

export class EmailDeliveryFailureError extends AppError {
  constructor() {
    super('EMAIL_DELIVERY_FAILURE', 'Failed to send email notification.', 500);
    this.name = 'EmailDeliveryFailureError';
  }
}

export class DuplicateSubscriptionError extends AppError {
  constructor() {
    super('DUPLICATE_SUBSCRIPTION', 'Subscription already exists for this email and repository.', 409);
    this.name = 'DuplicateSubscriptionError';
  }
}

export class DuplicateRepositoryError extends AppError {
  constructor() {
    super('DUPLICATE_REPOSITORY', 'Repository already exists.', 409);
    this.name = 'DuplicateRepositoryError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error.') {
    super('INTERNAL_SERVER_ERROR', message, 500);
    this.name = 'InternalServerError';
  }
}
