import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.config';
import { JwtAccessPayload, JwtRefreshPayload } from '../types/auth.types';
import { ApiError } from './apiError';
import { MESSAGES } from '../constants/messages';

export const signAccessToken = (payload: JwtAccessPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const signRefreshToken = (payload: JwtRefreshPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): JwtAccessPayload => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized(MESSAGES.TOKEN_EXPIRED);
    }
    throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
  }
};

export const verifyRefreshToken = (token: string): JwtRefreshPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  } catch (error: unknown) {
    throw ApiError.unauthorized(MESSAGES.REFRESH_TOKEN_INVALID);
  }
};
