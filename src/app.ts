import path from 'path';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.config';
import { apiRouter } from './routes';
import { HealthController } from './controllers/health.controller';
import { errorHandler } from './middleware/error.middleware';
import { generalRateLimiter } from './middleware/rateLimiter.middleware';
import { securitySanitizerMiddleware } from './middleware/security.middleware';
import { ApiError } from './utils/apiError';

export const createApp = (): Application => {
  const app = express();

  // Security HTTP headers (configured to allow AI Studio preview iframe and Swagger UI)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );

  // Body parsers with configurable payload limits
  app.use(express.json({ limit: env.REQUEST_PAYLOAD_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_PAYLOAD_LIMIT }));

  // NoSQL injection, prototype pollution sanitization & defensive security headers
  app.use(securitySanitizerMiddleware);

  // HTTP request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Rate Limiting
  app.use(generalRateLimiter);

  // Top-level Health, Liveness & Readiness Endpoints
  app.get('/health', HealthController.getHealth);
  app.get('/health/live', HealthController.getLiveness);
  app.get('/health/ready', HealthController.getReadiness);

  const publicDir = path.join(process.cwd(), 'public');

  // Root endpoint: serve interactive ERP frontend for browsers, return JSON for API clients & tests
  app.get('/', (req: Request, res: Response) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html') && env.NODE_ENV !== 'test') {
      return res.sendFile(path.join(publicDir, 'index.html'));
    }
    return res.status(200).json({
      success: true,
      service: 'MSEC Teacher Management & Academic ERP Backend',
      version: '1.0.0',
      status: 'healthy',
      docsEndpoint: '/api/v1/docs',
      openApiSpec: '/api/v1/openapi.json',
      healthEndpoint: '/api/v1/health',
      livenessEndpoint: '/health/live',
      readinessEndpoint: '/health/ready',
      timestamp: new Date().toISOString(),
    });
  });

  // Serve static frontend files (/app.js, /index.html, etc.)
  app.use(express.static(publicDir));

  // Mount API Gateway
  app.use('/api/v1', apiRouter);

  // 404 Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound(`Cannot find ${req.method} ${req.originalUrl} on this server`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

export const app = createApp();
