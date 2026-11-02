import { Response } from 'express';
import { HttpStatusCode, HTTP_STATUS } from '../constants/statusCodes';
import { PaginationMeta } from '../types/common.types';

export class ApiResponse {
  static success<T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: HttpStatusCode = HTTP_STATUS.OK,
    meta?: PaginationMeta | { timestamp: string }
  ): Response {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
      meta: meta || { timestamp: new Date().toISOString() },
    });
  }

  static created<T>(
    res: Response,
    message: string,
    data?: T,
    meta?: PaginationMeta | { timestamp: string }
  ): Response {
    return ApiResponse.success(res, message, data, HTTP_STATUS.CREATED, meta);
  }
}
