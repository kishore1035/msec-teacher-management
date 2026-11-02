import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

router.post(
  '/refresh-token',
  validateRequest(refreshTokenSchema),
  AuthController.refreshToken
);

router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

router.get(
  '/me',
  authenticate,
  AuthController.getMe
);

router.put(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);

export const authRouter = router;
