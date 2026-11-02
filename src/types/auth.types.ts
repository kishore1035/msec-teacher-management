import { UserRole } from '../constants/roles.constant';

export interface JwtAccessPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

export interface JwtRefreshPayload {
  userId: string;
  sessionId: string;
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  sessionId: string;
}

export interface UserResponseDTO {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
