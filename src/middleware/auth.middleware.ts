import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/user.model';
import { MESSAGES } from '../constants/messages';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
  }

  try {
    const decoded = verifyAccessToken(token);

    // Fetch user from DB including refreshTokens to verify active session
    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE));
    }

    // Check session validity
    const session = user.refreshTokens?.find((s) => s.sessionId === decoded.sessionId);
    if (!session) {
      return next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    next(error);
  }
};
