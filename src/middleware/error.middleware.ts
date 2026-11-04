import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS, HttpStatusCode } from '../constants/statusCodes';
import { env } from '../config/env.config';
import { logger } from '../config/logger.config';
import { MESSAGES } from '../constants/messages';
import { sanitizeLogPayload } from './security.middleware';

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
  } else if (err instanceof multer.MulterError) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `Uploaded file exceeds maximum allowed size (${env.MAX_FILE_UPLOAD_SIZE_MB} MB)`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded in a single request';
    } else {
      message = `File upload error: ${err.message}`;
    }
  } else if ((err as unknown as { name?: string }).name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = MESSAGES.VALIDATION_ERROR;
  } else if ((err as unknown as { code?: number }).code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = MESSAGES.DUPLICATE_RESOURCE;
  } else if ((err as unknown as { name?: string }).name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid resource ID format';
  } else if ((err as unknown as { type?: string }).type === 'entity.too.large') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Request payload exceeds maximum permitted size';
  } else if (err instanceof Error) {
    message = env.NODE_ENV === 'production' ? MESSAGES.INTERNAL_ERROR : err.message;
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
      stack: err.stack,
      body: sanitizeLogPayload(req.body),
      query: sanitizeLogPayload(req.query),
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
