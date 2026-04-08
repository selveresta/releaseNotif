import { z } from 'zod';

export const subscribeRequestSchema = z.object({
  email: z.string().trim().email(),
  repository: z.string().trim().min(1),
}).strict();

export const emailQuerySchema = z.object({
  email: z.string().trim().email(),
}).strict();

export const tokenParamSchema = z.object({
  token: z.string().trim().min(1),
}).strict();
