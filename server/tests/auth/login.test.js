'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('5. Authentication Automation Tests', () => {
  describe('POST /api/auth/login', () => {
    it('should login successfully as ADMIN with valid credentials', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'admin',
        password: 'admin@123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toMatchObject({
        username: 'admin',
        role: ROLES.ADMIN,
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should login successfully as FACULTY with valid credentials', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'faculty',
        password: 'faculty@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.role).toBe(ROLES.FACULTY);
    });

    it('should login successfully as NON_TEACHING_STAFF with valid credentials', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'staff',
        password: 'staff@123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.role).toBe(ROLES.NON_TEACHING_STAFF);
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'admin',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should return 401 for unknown user', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'unknown_user',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should return 401 for deactivated user', async () => {
      const res = await request.post('/api/auth/login').send({
        username: 'inactive_user',
        password: 'admin@123',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'ACCOUNT_DEACTIVATED');
    });

    it('should return 422 when username or password is missing', async () => {
      const res1 = await request.post('/api/auth/login').send({ username: 'admin' });
      expect(res1.status).toBe(422);

      const res2 = await request.post('/api/auth/login').send({ password: 'admin@123' });
      expect(res2.status).toBe(422);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return profile for valid ADMIN token', async () => {
      const token = getAuthToken(ROLES.ADMIN);
      const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toMatchObject({
        username: 'admin',
        role: ROLES.ADMIN,
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return profile for valid FACULTY token', async () => {
      const token = getAuthToken(ROLES.FACULTY);
      const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(ROLES.FACULTY);
    });

    it('should return profile for valid NON_TEACHING_STAFF token', async () => {
      const token = getAuthToken(ROLES.NON_TEACHING_STAFF);
      const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(ROLES.NON_TEACHING_STAFF);
    });

    it('should return 401 when Authorization header is missing', async () => {
      const res = await request.get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'MISSING_TOKEN');
    });

    it('should return 401 when token is invalid or malformed', async () => {
      const res = await request.get('/api/auth/me').set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_TOKEN');
    });
  });
});
