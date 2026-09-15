'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('6. Role-Based Authorization Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);
  const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

  describe('Admin-Only Routes Protection', () => {
    it('GET /api/dashboard/stats — ADMIN allowed (200), FACULTY forbidden (403), STAFF forbidden (403)', async () => {
      const resAdmin = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);

      const resFaculty = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${facultyToken}`);
      expect(resFaculty.status).toBe(403);
      expect(resFaculty.body.error).toHaveProperty('code', 'FORBIDDEN');

      const resStaff = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${staffToken}`);
      expect(resStaff.status).toBe(403);
      expect(resStaff.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('GET /api/users — ADMIN allowed (200), FACULTY forbidden (403), STAFF forbidden (403)', async () => {
      const resAdmin = await request.get('/api/users').set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);

      const resFaculty = await request.get('/api/users').set('Authorization', `Bearer ${facultyToken}`);
      expect(resFaculty.status).toBe(403);

      const resStaff = await request.get('/api/users').set('Authorization', `Bearer ${staffToken}`);
      expect(resStaff.status).toBe(403);
    });

    it('POST /api/students (create student) — ADMIN allowed, FACULTY forbidden (403), STAFF forbidden (403)', async () => {
      const payload = {
        registrationNo: 'REGNEW999',
        name: 'New Student',
        department: 'CSE',
        section: 'A',
        year: 1,
      };

      const resFaculty = await request.post('/api/students').set('Authorization', `Bearer ${facultyToken}`).send(payload);
      expect(resFaculty.status).toBe(403);

      const resStaff = await request.post('/api/students').set('Authorization', `Bearer ${staffToken}`).send(payload);
      expect(resStaff.status).toBe(403);
    });

    it('POST /api/systems (register system) — ADMIN allowed, FACULTY forbidden (403), STAFF forbidden (403)', async () => {
      const payload = {
        systemCode: 'PC-99',
        hostname: 'lab-pc99',
      };

      const resFaculty = await request.post('/api/systems').set('Authorization', `Bearer ${facultyToken}`).send(payload);
      expect(resFaculty.status).toBe(403);

      const resStaff = await request.post('/api/systems').set('Authorization', `Bearer ${staffToken}`).send(payload);
      expect(resStaff.status).toBe(403);
    });
  });

  describe('Unauthenticated Access Rejection', () => {
    it('should return 401 when accessing protected endpoints without token', async () => {
      const res = await request.get('/api/students');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'MISSING_TOKEN');
    });
  });
});
