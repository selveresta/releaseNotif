import * as grpc from '@grpc/grpc-js';
import { describe, expect, it, vi } from 'vitest';
import { createGrpcHandlers, mapGrpcError } from '../../src/grpc/grpc.server';
import { GitHubRateLimitError, InvalidRepositoryFormatError, TokenAlreadyUsedError } from '../../src/shared/errors/app-error';

describe('grpc transport', () => {
  it('supports subscribe', async () => {
    const subscriptionService = {
      subscribe: vi.fn().mockResolvedValue({
        message: 'Confirmation email sent. Please confirm your subscription.',
        email: 'user@example.com',
        repository: 'golang/go',
      }),
      confirm: vi.fn(),
      unsubscribe: vi.fn(),
      getSubscriptionsByEmail: vi.fn(),
    } as any;
    const metrics = {
      recordGrpcRequest: vi.fn(),
    } as any;

    const handlers = createGrpcHandlers(subscriptionService, metrics);
    const response = await new Promise<{ message: string; email: string; repository: string }>((resolve, reject) => {
      handlers.Subscribe(
        { request: { email: 'user@example.com', repository: 'golang/go' } } as never,
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result as { message: string; email: string; repository: string });
        },
      );
    });

    expect(subscriptionService.subscribe).toHaveBeenCalledWith({ email: 'user@example.com', repository: 'golang/go' });
    expect(response.repository).toBe('golang/go');
    expect(metrics.recordGrpcRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'Subscribe', status: 'success' }));
  });

  it('maps invalid repository format to INVALID_ARGUMENT', () => {
    const error = mapGrpcError(new InvalidRepositoryFormatError());
    expect(error.code).toBe(grpc.status.INVALID_ARGUMENT);
  });

  it('maps rate limit to RESOURCE_EXHAUSTED', () => {
    const error = mapGrpcError(new GitHubRateLimitError());
    expect(error.code).toBe(grpc.status.RESOURCE_EXHAUSTED);
  });

  it('maps token replay to FAILED_PRECONDITION', () => {
    const error = mapGrpcError(new TokenAlreadyUsedError('already used'));
    expect(error.code).toBe(grpc.status.FAILED_PRECONDITION);
  });
});
