import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export type AppMetrics = {
  registry: Registry;
  httpMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  render: () => Promise<string>;
  recordScannerRun: (outcome: 'success' | 'failure') => void;
  recordGithubRequest: (input: { endpoint: string; status: number; cached: boolean }) => void;
  recordEmailSend: (outcome: 'success' | 'failure') => void;
  recordScannerFailure: () => void;
  recordGrpcRequest: (input: { method: string; status: 'success' | 'failure'; durationSeconds: number }) => void;
};

export function createMetrics(enabled: boolean): AppMetrics {
  const registry = new Registry();
  if (enabled) {
    collectDefaultMetrics({ register: registry });
  }

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  });

  const scannerRunsTotal = new Counter({
    name: 'scanner_runs_total',
    help: 'Total scanner runs.',
    labelNames: ['outcome'] as const,
    registers: [registry],
  });

  const scannerRunFailuresTotal = new Counter({
    name: 'scanner_run_failures_total',
    help: 'Total scanner run failures.',
    registers: [registry],
  });

  const githubApiRequestsTotal = new Counter({
    name: 'github_api_requests_total',
    help: 'Total GitHub API requests.',
    labelNames: ['endpoint', 'status', 'cached'] as const,
    registers: [registry],
  });

  const githubApiRateLimitTotal = new Counter({
    name: 'github_api_rate_limit_total',
    help: 'Total GitHub API rate limit hits.',
    registers: [registry],
  });

  const githubApiFailuresTotal = new Counter({
    name: 'github_api_failures_total',
    help: 'Total GitHub API failures.',
    registers: [registry],
  });

  const emailsSentTotal = new Counter({
    name: 'emails_sent_total',
    help: 'Total emails successfully sent.',
    registers: [registry],
  });

  const emailSendFailuresTotal = new Counter({
    name: 'email_send_failures_total',
    help: 'Total email send failures.',
    registers: [registry],
  });

  const grpcRequestsTotal = new Counter({
    name: 'grpc_requests_total',
    help: 'Total gRPC requests.',
    labelNames: ['method', 'status'] as const,
    registers: [registry],
  });

  const grpcRequestFailuresTotal = new Counter({
    name: 'grpc_request_failures_total',
    help: 'Total gRPC request failures.',
    labelNames: ['method'] as const,
    registers: [registry],
  });

  const grpcRequestDurationSeconds = new Histogram({
    name: 'grpc_request_duration_seconds',
    help: 'gRPC request duration in seconds.',
    labelNames: ['method', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry],
  });

  function httpMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.path;
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };

      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    });

    next();
  }

  return {
    registry,
    httpMiddleware,
    async render() {
      return registry.metrics();
    },
    recordScannerRun(outcome) {
      scannerRunsTotal.inc({ outcome });
    },
    recordGithubRequest(input) {
      githubApiRequestsTotal.inc({
        endpoint: input.endpoint,
        status: String(input.status),
        cached: String(input.cached),
      });
      if (input.status === 429) {
        githubApiRateLimitTotal.inc();
      }
      if (input.status >= 500 || input.status === 0) {
        githubApiFailuresTotal.inc();
      }
    },
    recordEmailSend(outcome) {
      if (outcome === 'success') {
        emailsSentTotal.inc();
        return;
      }

      emailSendFailuresTotal.inc();
    },
    recordScannerFailure() {
      scannerRunFailuresTotal.inc();
    },
    recordGrpcRequest(input) {
      grpcRequestsTotal.inc({ method: input.method, status: input.status });
      grpcRequestDurationSeconds.observe({ method: input.method, status: input.status }, input.durationSeconds);
      if (input.status === 'failure') {
        grpcRequestFailuresTotal.inc({ method: input.method });
      }
    },
  };
}
