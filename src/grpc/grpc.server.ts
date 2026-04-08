import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { SubscriptionService } from '../services/subscription.service';
import type { AppMetrics } from '../infrastructure/metrics/metrics';
import { AppError, DuplicateSubscriptionError, InvalidRepositoryFormatError, RepositoryNotFoundError, SubscriptionAlreadyExistsError, TokenAlreadyUsedError, TokenNotFoundError, UnauthorizedError } from '../shared/errors/app-error';
import { GithubRateLimitError } from '../integrations/github/github.errors';
import { GitHubRateLimitError } from '../shared/errors/app-error';

const packageDefinition = protoLoader.loadSync(path.resolve(process.cwd(), 'src/grpc/proto/subscriptions.proto'), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const loadedProto = grpc.loadPackageDefinition(packageDefinition) as unknown as {
  release_notif: {
    v1: {
      SubscriptionService: grpc.ServiceClientConstructor;
    };
  };
};

export function mapGrpcError(error: unknown): grpc.ServiceError {
  if (error instanceof UnauthorizedError) {
    return { name: 'UnauthorizedError', message: error.message, code: grpc.status.UNAUTHENTICATED } as grpc.ServiceError;
  }
  if (error instanceof InvalidRepositoryFormatError) {
    return { name: 'InvalidRepositoryFormatError', message: error.message, code: grpc.status.INVALID_ARGUMENT } as grpc.ServiceError;
  }
  if (error instanceof RepositoryNotFoundError) {
    return { name: 'RepositoryNotFoundError', message: error.message, code: grpc.status.NOT_FOUND } as grpc.ServiceError;
  }
  if (error instanceof GithubRateLimitError || error instanceof GitHubRateLimitError) {
    return { name: 'GithubRateLimitError', message: error.message, code: grpc.status.RESOURCE_EXHAUSTED } as grpc.ServiceError;
  }
  if (error instanceof SubscriptionAlreadyExistsError || error instanceof DuplicateSubscriptionError) {
    return { name: 'ConflictError', message: error.message, code: grpc.status.ALREADY_EXISTS } as grpc.ServiceError;
  }
  if (error instanceof TokenNotFoundError) {
    return { name: 'TokenNotFoundError', message: error.message, code: grpc.status.NOT_FOUND } as grpc.ServiceError;
  }
  if (error instanceof TokenAlreadyUsedError) {
    return { name: 'TokenAlreadyUsedError', message: error.message, code: grpc.status.FAILED_PRECONDITION } as grpc.ServiceError;
  }
  if (error instanceof AppError) {
    return { name: error.name, message: error.message, code: grpc.status.INTERNAL } as grpc.ServiceError;
  }

  return { name: 'InternalError', message: 'Internal server error.', code: grpc.status.INTERNAL } as grpc.ServiceError;
}

export function createGrpcHandlers(service: SubscriptionService, metrics?: AppMetrics) {
  async function handle<TRequest, TResponse>(
    method: string,
    operation: (request: TRequest) => Promise<TResponse>,
    call: grpc.ServerUnaryCall<TRequest, TResponse>,
    callback: grpc.sendUnaryData<TResponse>,
  ) {
    const startedAt = process.hrtime.bigint();
    try {
      const result = await operation(call.request);
      metrics?.recordGrpcRequest({
        method,
        status: 'success',
        durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
      });
      callback(null, result);
    } catch (error) {
      metrics?.recordGrpcRequest({
        method,
        status: 'failure',
        durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
      });
      callback(mapGrpcError(error));
    }
  }

  return {
    Subscribe: (call: grpc.ServerUnaryCall<{ email: string; repository: string }, { message: string; email: string; repository: string }>, callback: grpc.sendUnaryData<{ message: string; email: string; repository: string }>) =>
      handle('Subscribe', (request) => service.subscribe(request), call, callback),
    ConfirmSubscription: (call: grpc.ServerUnaryCall<{ token: string }, { message: string }>, callback: grpc.sendUnaryData<{ message: string }>) =>
      handle('ConfirmSubscription', (request) => service.confirm(request.token), call, callback),
    UnsubscribeSubscription: (call: grpc.ServerUnaryCall<{ token: string }, { message: string }>, callback: grpc.sendUnaryData<{ message: string }>) =>
      handle('UnsubscribeSubscription', (request) => service.unsubscribe(request.token), call, callback),
    GetSubscriptionsByEmail: (call: grpc.ServerUnaryCall<{ email: string }, { email: string; subscriptions: Array<{ repository: string; status: string; createdAt: string }> }>, callback: grpc.sendUnaryData<{ email: string; subscriptions: Array<{ repository: string; status: string; createdAt: string }> }>) =>
      handle('GetSubscriptionsByEmail', (request) => service.getSubscriptionsByEmail(request.email), call, callback),
  };
}

export function createGrpcServer(service: SubscriptionService, metrics: AppMetrics) {
  const server = new grpc.Server();
  const subscriptionService: grpc.UntypedServiceImplementation = createGrpcHandlers(service, metrics);

  server.addService(loadedProto.release_notif.v1.SubscriptionService.service, subscriptionService);

  return {
    async start(port: number) {
      await new Promise<void>((resolve, reject) => {
        server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (bindError) => {
          if (bindError) {
            reject(bindError);
            return;
          }

          server.start();
          resolve();
        });
      });
    },
    stop() {
      return new Promise<void>((resolve) => {
        server.tryShutdown(() => resolve());
      });
    },
    server,
  };
}
