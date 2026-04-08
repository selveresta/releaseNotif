# GitHub Release Notification API

Monolith MVP for subscribing email addresses to GitHub repository release notifications.

## Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Drizzle ORM + drizzle-kit
- Zod
- nodemailer
- node-cron
- Redis
- gRPC via `@grpc/grpc-js`
- Prometheus metrics via `prom-client`
- Vitest
- Docker + docker-compose
- Mailpit for local email inspection

## Architecture

The codebase stays in one monolith and keeps the concerns separated:

- controllers: transport-level request/response handling
- services: business logic
- repositories: database access only
- integrations/github: GitHub API client plus cache wrapper
- notifier: email templates and delivery
- scanner: scheduled release scanning
- grpc: gRPC transport layer built on top of the same services
- infrastructure/redis: Redis connection handling
- infrastructure/metrics: Prometheus metrics
- middleware: API key auth and centralized error handling

## Features

- Subscribe an email to a GitHub repository release feed
- Confirm subscription by token
- Unsubscribe by token
- List active subscriptions for an email
- Scan repositories for new releases
- Send confirmation and release notification emails
- Serve a simple HTML subscription page at `/`
- Expose gRPC methods for the same subscription flows
- Expose Prometheus metrics at `/metrics`
- Protect REST endpoints with `x-api-key`
- Cache GitHub responses in Redis with a 10 minute TTL

## REST API

Swagger is the source of truth. The implemented endpoints are:

- `POST /api/subscribe`
- `GET /api/confirm/{token}`
- `GET /api/unsubscribe/{token}`
- `GET /api/subscriptions?email={email}`

The public HTML page is served separately at `/` and submits through the backend route `POST /subscribe` so it does not need an API key roundtrip.

## gRPC

The monolith also exposes a gRPC server on `GRPC_PORT` when `ENABLE_GRPC=true`.
Its requests are counted in Prometheus metrics.

Methods:

- `Subscribe`
- `ConfirmSubscription`
- `UnsubscribeSubscription`
- `GetSubscriptionsByEmail`

The gRPC transport reuses the same service layer as REST.

## Redis Cache

Redis is used as an optional cache layer for GitHub API responses.

Cached entries:

- repository existence checks
- latest release lookups

TTL:

- 600 seconds

Fallback behavior:

- if Redis is unavailable, the app keeps working without cache
- the scanner does not depend on Redis for correctness

## API Key Authentication

REST endpoints under `/api` require an `x-api-key` header only where a header-based client can actually send one.

Protected endpoints:

- `POST /api/subscribe`
- `GET /api/subscriptions`

Public endpoints:

- `GET /api/confirm/{token}`
- `GET /api/unsubscribe/{token}`
- `GET /`
- `POST /subscribe`

The HTML page uses the same-origin backend submit route and does not need to know the API key.
The token-link endpoints stay public because the confirmation and unsubscribe links are sent by email and must work without a custom request header.

## Metrics

`GET /metrics` returns Prometheus text exposition format.

Implemented metrics:

- `http_requests_total`
- `http_request_duration_seconds`
- `scanner_runs_total`
- `scanner_run_failures_total`
- `github_api_requests_total`
- `github_api_rate_limit_total`
- `github_api_failures_total`
- `emails_sent_total`
- `email_send_failures_total`
- `grpc_requests_total`
- `grpc_request_failures_total`
- `grpc_request_duration_seconds`

## Scanner Behavior

The scanner runs on `SCANNER_CRON` and processes repositories, not subscriptions.

Rules:

- one GitHub release check per repository
- if no release exists, only `last_checked_at` is updated
- if `last_seen_tag` is `null` and a release exists, the tag is stored as a baseline and no email is sent
- if the release tag is unchanged, no email is sent
- if the release tag changes, all active subscriptions for that repository receive a notification email
- if any subscriber delivery fails, the scanner still continues sending to the remaining subscribers
- `last_seen_tag` is updated at the end of the run even when some deliveries fail
- a failing repository does not stop the whole scanner job
- GitHub `429` is logged and does not crash the job
- scanner overlap is guarded in-process

`last_seen_tag` lives on `repositories`, not on `subscriptions`.

## Delivery Model

Notification delivery is idempotent and tracked in `notification_deliveries`.

- each repository release is delivered at most once per subscriber
- the scanner records delivery attempts per `(subscription_id, tag)`
- successful deliveries are marked `sent`
- failed deliveries are marked `failed`
- failed deliveries are not retried in this MVP
- `last_seen_tag` is only a repository-level marker that a release was already processed

## GitHub 429 Handling

GitHub rate limit responses are mapped to controlled application errors.

Behavior:

- subscription flows return a `429`-style controlled error instead of masking rate limits as `404`
- scanner logs the failure and continues with the next repository
- `last_seen_tag` is not updated for a repository that failed with `429`

## Confirmation Flow

1. `POST /api/subscribe`
2. GitHub repo existence is verified
3. A repository row is created or reused
4. A pending subscription row is created with confirm and unsubscribe tokens
5. Confirmation email is sent
6. `GET /api/confirm/{token}` activates the subscription

## Unsubscribe Flow

1. `GET /api/unsubscribe/{token}`
2. The subscription is switched to `unsubscribed`
3. `unsubscribed_at` is stored

## Local Run

```bash
pnpm install
docker compose up -d postgres redis mailpit
pnpm build
pnpm start
```

`pnpm start` automatically reads a `.env` file from the project root.
The local `.env` uses `localhost` hosts, so the supporting services must be reachable on the exposed ports.
Migrations run automatically during startup.

## Docker Run

```bash
docker compose up --build
```

Services:

- app: `http://localhost:3000`
- gRPC: `localhost:50051`
- Mailpit UI: `http://localhost:8025`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Environment Variables

Required:

- `PORT`
- `DATABASE_URL`
- `API_KEY`
- `SCANNER_CRON`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM`
- `APP_BASE_URL`
- `REDIS_URL`

Optional:

- `GITHUB_TOKEN`
- `GITHUB_API_BASE_URL` defaults to `https://api.github.com`
- `SMTP_USER`
- `SMTP_PASS`
- `GRPC_PORT` defaults to `50051`
- `ENABLE_GRPC` defaults to `true`
- `ENABLE_METRICS` defaults to `true`
- `LOG_LEVEL` defaults to `info`

See [`.env.example`](./.env.example) for a complete sample.

## Deployment

This repository is prepared for container-based deployment, but no live deployment URL is claimed here.

Deployment checklist:

- build the Docker image from `Dockerfile`
- provide production values for `DATABASE_URL`, `API_KEY`, `REDIS_URL`, SMTP, GitHub, and `APP_BASE_URL`
- expose the HTTP port and, if needed, `GRPC_PORT`
- keep migrations enabled on startup
- ensure Redis and SMTP are reachable from the runtime environment

The HTML page is server-rendered by the app and works without any frontend build step.

## Tests

```bash
pnpm test
pnpm build
```

## CI

GitHub Actions runs on `push` and `pull_request` and executes:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

## Schema Policy

The uniqueness rule for active/pending subscriptions per `email + repository_id` is enforced with a partial unique index in the SQL migration.

This rule is intentionally kept as hand-written migration SQL because it is easier to preserve precisely than to regenerate from schema helpers. Keep the migration and schema notes in sync when changing subscription uniqueness behavior.

## Limitations

- This is a single-monolith MVP with no queue system
- Email sending is synchronous
- Redis is optional and only a cache layer
- The gRPC interface is additive and reuses the REST business logic
- Swagger remains the source of truth for public REST contracts
