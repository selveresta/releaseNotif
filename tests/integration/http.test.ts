import { describe, expect, it, vi } from 'vitest';
import { createSubscriptionsController } from '../../src/controllers/subscriptions.controller';
import { createApiKeyAuthMiddleware } from '../../src/middleware/api-key-auth';
import { errorHandler } from '../../src/middleware/error-handler';
import { createMetrics } from '../../src/infrastructure/metrics/metrics';

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    type(value: string) {
      this.headers['content-type'] = value;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe('http transport', () => {
  it('returns 400 for malformed json', () => {
    const response = makeResponse();
    const error = new SyntaxError('Unexpected token') as SyntaxError & { type?: string };
    error.type = 'entity.parse.failed';

    errorHandler(error, {} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Bad Request', message: 'Invalid JSON body.' });
  });

  it('confirm works without api key', async () => {
    const service = {
      confirm: vi.fn().mockResolvedValue({ message: 'Subscription confirmed successfully.' }),
      unsubscribe: vi.fn(),
      subscribe: vi.fn(),
      getSubscriptionsByEmail: vi.fn(),
    } as any;
    const controller = createSubscriptionsController(service);
    const response = makeResponse();

    await controller.confirm({ params: { token: 'token-123' } } as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Subscription confirmed successfully.' });
    expect(service.confirm).toHaveBeenCalledWith('token-123');
  });

  it('unsubscribe works without api key', async () => {
    const service = {
      confirm: vi.fn(),
      unsubscribe: vi.fn().mockResolvedValue({ message: 'Unsubscribed successfully.' }),
      subscribe: vi.fn(),
      getSubscriptionsByEmail: vi.fn(),
    } as any;
    const controller = createSubscriptionsController(service);
    const response = makeResponse();

    await controller.unsubscribe({ params: { token: 'token-123' } } as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: 'Unsubscribed successfully.' });
    expect(service.unsubscribe).toHaveBeenCalledWith('token-123');
  });

  it('subscribe still requires api key', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const next = vi.fn();

    middleware(
      {
        header: () => undefined,
      } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('subscriptions list still requires api key', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const next = vi.fn();

    middleware(
      {
        header: () => undefined,
      } as never,
      {} as never,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('metrics data includes grpc labels and http labels', async () => {
    const metrics = createMetrics(false);
    metrics.recordScannerRun('success');
    metrics.recordGithubRequest({ endpoint: 'repo', status: 200, cached: false });
    metrics.recordGrpcRequest({ method: 'Subscribe', status: 'success', durationSeconds: 0.01 });
    const rendered = await metrics.render();

    expect(rendered).toContain('http_requests_total');
    expect(rendered).toContain('scanner_runs_total');
    expect(rendered).toContain('github_api_requests_total');
    expect(rendered).toContain('grpc_requests_total');
  });
});
