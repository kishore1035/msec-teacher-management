import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.config';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/error.middleware';
import { generalRateLimiter } from './middleware/rateLimiter.middleware';
import { ApiError } from './utils/apiError';

export const createApp = (): Application => {
  const app = express();

  // Security HTTP headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // HTTP request logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Rate Limiting
  app.use(generalRateLimiter);

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
