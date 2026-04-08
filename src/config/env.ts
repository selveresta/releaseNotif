import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_API_BASE_URL: z.string().url().default('https://api.github.com'),
  SCANNER_CRON: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1),
  APP_BASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  GRPC_PORT: z.coerce.number().int().positive().default(50051),
  ENABLE_GRPC: z.enum(['true', 'false']).default('true').optional(),
  ENABLE_METRICS: z.enum(['true', 'false']).default('true').optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info').optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return result.data;
}
