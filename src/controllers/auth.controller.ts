import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { HTTP_STATUS } from '../constants/statusCodes';
import { ApiError } from '../utils/apiError';

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await AuthService.login(req.body, userAgent, ipAddress);

    return ApiResponse.success(res, MESSAGES.LOGIN_SUCCESS, result, HTTP_STATUS.OK);
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const tokens = await AuthService.refreshToken(refreshToken, userAgent, ipAddress);

    return ApiResponse.success(res, MESSAGES.TOKEN_REFRESH_SUCCESS, tokens, HTTP_STATUS.OK);
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    }

    await AuthService.logout(req.user.id, req.user.sessionId);

    return ApiResponse.success(res, MESSAGES.LOGOUT_SUCCESS, null, HTTP_STATUS.OK);
  });

  static getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    }

    const profile = await AuthService.getMe(req.user);

    return ApiResponse.success(res, MESSAGES.RESOURCE_FETCHED, profile, HTTP_STATUS.OK);
  });

  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
    }

    await AuthService.changePassword(req.user.id, req.body);

    return ApiResponse.success(res, MESSAGES.PASSWORD_CHANGED, null, HTTP_STATUS.OK);
  });
}
