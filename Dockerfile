FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml tsconfig.json vitest.config.ts drizzle.config.ts swagger.yaml ./
COPY src ./src
COPY tests ./tests
COPY drizzle ./drizzle

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/grpc/proto ./src/grpc/proto
COPY swagger.yaml ./swagger.yaml

CMD ["node", "dist/server.js"]
