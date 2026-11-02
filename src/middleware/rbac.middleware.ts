import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.constant';
import { ApiError } from '../utils/apiError';
import { MESSAGES } from '../constants/messages';

export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(MESSAGES.FORBIDDEN));
    }

    next();
  };
};
