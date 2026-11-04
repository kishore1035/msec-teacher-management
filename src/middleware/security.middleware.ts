import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SENSITIVE_LOG_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'apikey',
  'x-api-key',
  'secret',
  'clientsecret',
  'smtppass',
  'vapidprivatekey',
  'fcmserverkey',
]);

/**
 * Recursively strips MongoDB operator keys ($gt, $ne, $where, etc.)
 * and prototype pollution keys (__proto__, constructor, prototype).
 */
export const sanitizeNoSqlPayload = <T>(input: T): T => {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeNoSqlPayload(item)) as unknown as T;
  }

  if (input instanceof Date || Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        continue;
      }
      // Strip MongoDB query operators or dotted path injection keys
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      sanitized[key] = sanitizeNoSqlPayload(value);
    }
    return sanitized as T;
  }

  return input;
};

/**
 * Deeply redacts credentials, tokens, passwords, and secrets before logging.
 */
export const sanitizeLogPayload = (input: unknown, depth = 0): unknown => {
  if (depth > 6 || input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLogPayload(item, depth + 1));
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[_-]/g, '');
      if (SENSITIVE_LOG_KEYS.has(normalizedKey) || normalizedKey.includes('password') || normalizedKey.includes('secret') || normalizedKey.includes('token') || normalizedKey.includes('apikey')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogPayload(value, depth + 1);
      }
    }
    return sanitized;
  }

  return input;
};

/**
 * Express middleware that sanitizes incoming body, query, and params against NoSQL injection
 * and attaches defensive HTTP headers + correlation ID.
 */
export const securitySanitizerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeNoSqlPayload(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeNoSqlPayload(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeNoSqlPayload(req.params);
  }

  next();
};
