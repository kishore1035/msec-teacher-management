import crypto from 'crypto';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { MESSAGES } from '../constants/messages';
import { AuthTokens, AuthenticatedUser, UserResponseDTO } from '../types/auth.types';
import { LoginInput, ChangePasswordInput } from '../validators/auth.validator';

const MAX_SESSIONS_PER_USER = 5;

export class AuthService {
  /**
   * Authenticate user with credentials and issue tokens
   */
  static async login(
    input: LoginInput,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ user: UserResponseDTO; tokens: AuthTokens }> {
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+password +refreshTokens');

    if (!user) {
      throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
    }

    const sessionId = crypto.randomUUID();
    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId,
    });

    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      sessionId,
      tokenVersion: 1,
    });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Prune expired sessions and enforce max active sessions
    const now = new Date();
    const activeSessions = user.refreshTokens.filter((s) => s.expiresAt > now);

    if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
      activeSessions.shift(); // Evict oldest session
    }

    activeSessions.push({
      sessionId,
      tokenHash,
      userAgent,
      ipAddress,
      createdAt: now,
      expiresAt,
    });

    user.refreshTokens = activeSessions;
    user.lastLogin = now;
    await user.save();

    const userDto: UserResponseDTO = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userDto,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Rotate refresh token and issue a fresh access token
   */
  static async refreshToken(
    refreshTokenStr: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const decoded = verifyRefreshToken(refreshTokenStr);

    const user = await User.findById(decoded.userId).select('+refreshTokens');
    if (!user) {
      throw ApiError.unauthorized(MESSAGES.REFRESH_TOKEN_INVALID);
    }

    if (!user.isActive) {
      throw ApiError.forbidden(MESSAGES.ACCOUNT_INACTIVE);
    }

    const tokenHash = crypto.createHash('sha256').update(refreshTokenStr).digest('hex');
    const sessionIndex = user.refreshTokens.findIndex((s) => s.sessionId === decoded.sessionId);

    // If session doesn't exist or hash doesn't match: token reuse detected!
    if (sessionIndex === -1 || user.refreshTokens[sessionIndex]?.tokenHash !== tokenHash) {
      // Invalidate all tokens for security
      user.refreshTokens = [];
      await user.save();
      throw ApiError.unauthorized(MESSAGES.REFRESH_TOKEN_REUSED);
    }

    // Check expiration
    if (user.refreshTokens[sessionIndex]!.expiresAt < new Date()) {
      user.refreshTokens.splice(sessionIndex, 1);
      await user.save();
      throw ApiError.unauthorized(MESSAGES.REFRESH_TOKEN_INVALID);
    }

    // Rotate token
    const newSessionId = crypto.randomUUID();
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: newSessionId,
    });

    const newRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      sessionId: newSessionId,
      tokenVersion: 1,
    });

    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Replace old session with new session
    user.refreshTokens.splice(sessionIndex, 1, {
      sessionId: newSessionId,
      tokenHash: newTokenHash,
      userAgent,
      ipAddress,
      createdAt: new Date(),
      expiresAt,
    });

    await user.save();

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Invalidate current user session
   */
  static async logout(userId: string, sessionId: string): Promise<void> {
    const user = await User.findById(userId).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((s) => s.sessionId !== sessionId);
      await user.save();
    }
  }

  /**
   * Get current authenticated user profile
   */
  static async getMe(currentUser: AuthenticatedUser): Promise<UserResponseDTO> {
    const user = await User.findById(currentUser.id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Change password and revoke all active sessions
   */
  static async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<void> {
    const user = await User.findById(userId).select('+password +refreshTokens');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isMatch = await user.comparePassword(input.currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    user.password = input.newPassword;
    user.refreshTokens = []; // Force re-login on all devices
    await user.save();
  }
}
