import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS, HttpStatusCode } from '../constants/statusCodes';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { MESSAGES } from '../constants/messages';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode: HttpStatusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message: string = MESSAGES.INTERNAL_ERROR;
  let errors: Array<{ field?: string; message: string }> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if ((err as unknown as { name?: string }).name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = MESSAGES.VALIDATION_ERROR;
  } else if ((err as unknown as { code?: number }).code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = MESSAGES.DUPLICATE_RESOURCE;
  } else if ((err as unknown as { name?: string }).name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid resource ID format';
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
      stack: err.stack,
      body: req.body,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${statusCode}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
