import bcrypt from 'bcrypt';
import { env } from '../config/env.config';

const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (candidatePassword: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(candidatePassword, hashedPassword);
};
