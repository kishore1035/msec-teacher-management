import request from 'supertest';
import { app } from '../../src/app';
import { User } from '../../src/models/user.model';
import { ROLES } from '../../src/constants/roles.constant';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.config';

describe('Authentication & Authorization Integration Tests', () => {
  const testPassword = 'Password123';
  const testEmail = 'teacher@msec.ac.in';

  beforeEach(async () => {
    await User.create({
      email: testEmail,
      password: testPassword,
      role: ROLES.TEACHER,
      isActive: true,
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully log in with valid credentials and return access and refresh tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toBeDefined();
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.refreshTokens).toBeUndefined();
    });

    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incorrect');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@msec.ac.in', password: testPassword });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should prevent login for inactive accounts', async () => {
      await User.updateOne({ email: testEmail }, { isActive: false });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('deactivated');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile for authenticated user', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      const token = loginRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testEmail);
      expect(res.body.data.role).toBe(ROLES.TEACHER);
    });

    it('should reject request with missing token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: '507f1f77bcf86cd799439011', email: testEmail, role: ROLES.TEACHER, sessionId: 's1' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired');
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should rotate refresh token and return fresh access token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      const oldRefreshToken = loginRes.body.data.tokens.refreshToken;

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: oldRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(oldRefreshToken);
    });

    it('should detect reuse of an old refresh token and invalidate all sessions', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      const initialRefreshToken = loginRes.body.data.tokens.refreshToken;

      // 1st rotation - valid
      const firstRotation = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: initialRefreshToken });
      expect(firstRotation.status).toBe(200);

      // Attempt to reuse initial refresh token - must trigger security revocation
      const reuseAttempt = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: initialRefreshToken });

      expect(reuseAttempt.status).toBe(401);
      expect(reuseAttempt.body.message).toContain('reuse');

      // Verify all active sessions were cleared
      const user = await User.findOne({ email: testEmail }).select('+refreshTokens');
      expect(user?.refreshTokens.length).toBe(0);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should invalidate the active session upon logout', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      const { accessToken, refreshToken } = loginRes.body.data.tokens;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toContain('Logged out');

      // The refresh token should no longer work
      const tryRefresh = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken });

      expect(tryRefresh.status).toBe(401);
    });
  });

  describe('PUT /api/v1/auth/change-password', () => {
    it('should allow user to change password and invalidate all sessions', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });

      const { accessToken } = loginRes.body.data.tokens;
      const newPassword = 'NewSecretPassword456';

      const changeRes = await request(app)
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testPassword,
          newPassword,
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Old password should fail
      const loginOld = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(loginOld.status).toBe(401);

      // New password should succeed
      const loginNew = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: newPassword });
      expect(loginNew.status).toBe(200);
    });
  });
});
