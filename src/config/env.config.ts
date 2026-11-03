import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' ? undefined : val), schema);

const envSchema = z.object({
  NODE_ENV: emptyToUndefined(
    z.enum(['development', 'test', 'production']).default('development')
  ),
  PORT: z.preprocess(
    (val) => (val === '' || val === undefined || val === '8080' ? '3000' : val),
    z.string().transform((val) => parseInt(val, 10))
  ),
  MONGODB_URI: emptyToUndefined(
    z.string().default('mongodb://localhost:27017/teacher_management_db')
  ),
  JWT_ACCESS_SECRET: emptyToUndefined(
    z
      .string()
      .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long')
      .default('msec-dev-jwt-access-secret-2026')
  ),
  JWT_ACCESS_EXPIRES_IN: emptyToUndefined(z.string().default('15m')),
  JWT_REFRESH_SECRET: emptyToUndefined(
    z
      .string()
      .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long')
      .default('msec-dev-jwt-refresh-secret-2026')
  ),
  JWT_REFRESH_EXPIRES_IN: emptyToUndefined(z.string().default('7d')),
  RATE_LIMIT_WINDOW_MS: emptyToUndefined(
    z
      .string()
      .default('900000')
      .transform((val) => parseInt(val, 10))
  ),
  RATE_LIMIT_MAX_REQUESTS: emptyToUndefined(
    z
      .string()
      .default('100')
      .transform((val) => parseInt(val, 10))
  ),
  AUTH_RATE_LIMIT_MAX_REQUESTS: emptyToUndefined(
    z
      .string()
      .default('5')
      .transform((val) => parseInt(val, 10))
  ),
  COMMUNICATION_RATE_LIMIT_MAX_REQUESTS: emptyToUndefined(
    z
      .string()
      .default('30')
      .transform((val) => parseInt(val, 10))
  ),
  CORS_ORIGIN: emptyToUndefined(z.string().default('*')),
  LOG_LEVEL: emptyToUndefined(
    z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info')
  ),
  // Phase 9: Notification Delivery & Retention Configuration
  EMAIL_PROVIDER_ENABLED: emptyToUndefined(
    z
      .string()
      .default('false')
      .transform((val) => val === 'true')
  ),
  SMTP_HOST: emptyToUndefined(z.string().optional()),
  SMTP_PORT: emptyToUndefined(
    z
      .string()
      .default('587')
      .transform((val) => parseInt(val, 10))
  ),
  SMTP_USER: emptyToUndefined(z.string().optional()),
  SMTP_PASS: emptyToUndefined(z.string().optional()),
  EMAIL_FROM: emptyToUndefined(z.string().default('noreply@msec.ac.in')),
  SMS_PROVIDER_ENABLED: emptyToUndefined(
    z
      .string()
      .default('false')
      .transform((val) => val === 'true')
  ),
  SMS_PROVIDER_URL: emptyToUndefined(z.string().optional()),
  SMS_API_KEY: emptyToUndefined(z.string().optional()),
  SMS_SENDER_ID: emptyToUndefined(z.string().default('MSECED')),
  PUSH_PROVIDER_ENABLED: emptyToUndefined(
    z
      .string()
      .default('false')
      .transform((val) => val === 'true')
  ),
  FCM_SERVER_KEY: emptyToUndefined(z.string().optional()),
  PUSH_VAPID_PUBLIC_KEY: emptyToUndefined(z.string().optional()),
  PUSH_VAPID_PRIVATE_KEY: emptyToUndefined(z.string().optional()),
  NOTIFICATION_RETENTION_DAYS: emptyToUndefined(
    z
      .string()
      .default('90')
      .transform((val) => parseInt(val, 10))
  ),
  NOTIFICATION_MAX_RETRIES: emptyToUndefined(
    z
      .string()
      .default('3')
      .transform((val) => parseInt(val, 10))
  ),
  NOTIFICATION_RETRY_BASE_MS: emptyToUndefined(
    z
      .string()
      .default('200')
      .transform((val) => parseInt(val, 10))
  ),
  NOTIFICATION_BATCH_SIZE: emptyToUndefined(
    z
      .string()
      .default('500')
      .transform((val) => parseInt(val, 10))
  ),
});

const rawEnv = {
  ...process.env,
  ...(process.env['JEST_WORKER_ID'] !== undefined ? { NODE_ENV: 'test' } : {}),
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const env = parsed.data;
