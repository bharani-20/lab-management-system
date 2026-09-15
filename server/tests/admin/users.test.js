'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('23. User Management Tests (ADMIN only)', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  describe('Authorization Check', () => {
    it('FACULTY should receive 403 when accessing /api/users', async () => {
      const res = await request.get('/api/users').set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('User CRUD & Password Security', () => {
    it('GET /api/users should list users without exposing passwordHash', async () => {
      const res = await request.get('/api/users').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.every((u) => !u.passwordHash)).toBe(true);
    });

    it('POST /api/users should create a new staff account', async () => {
      const newUser = {
        username: 'prof_alan',
        password: 'Password@123',
        name: 'Prof. Alan Turing',
        role: ROLES.FACULTY,
      };

      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        username: 'prof_alan',
        name: 'Prof. Alan Turing',
        role: ROLES.FACULTY,
      });
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('POST /api/users should reject duplicate username with 409', async () => {
      const res = await request
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admin', // already exists
          password: 'Password@123',
          name: 'Duplicate Admin',
          role: ROLES.ADMIN,
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'DUPLICATE_USERNAME');
    });
  });
});
