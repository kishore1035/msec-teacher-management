import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config';
import { ApiError } from '../utils/apiError';
import { MESSAGES } from '../constants/messages';

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests(MESSAGES.TOO_MANY_REQUESTS));
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Too many authentication attempts. Please try again after 15 minutes.'));
  },
});
