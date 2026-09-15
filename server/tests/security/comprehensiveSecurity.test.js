'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');
const jwt = require('jsonwebtoken');
const config = require('../../src/config/env');

describe('Comprehensive Security, Injection & Role-Based Access Control (RBAC) Automation Suite', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);
  const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

  describe('1. Injection & Malformed Payload Resilience', () => {
    it('should safely handle SQL/Prisma injection strings in registrationNo and names', async () => {
      const injectionPayload = {
        registerNumber: "'; DROP TABLE students; --",
        studentName: "<script>alert('xss')</script>",
        systemNumber: 'PC-01',
        sessionId: 'sess_sec_inj_01',
        department: 'IT',
        section: 'A',
        year: 2,
        duration: 60,
      };

      const res = await request.post('/api/attendance').send(injectionPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Stored safely as plain strings, database is intact
      expect(res.body.data.studentName).toContain("<script>alert('xss')</script>");
    });

    it('should reject invalid / boundary durationMinutes inputs (e.g. negative, > 480 mins)', async () => {
      const negativeRes = await request.post('/api/sessions').send({
        localId: 'sess_neg_dur',
        registrationNo: 'REG_TEST_01',
        name: 'Test Student',
        department: 'IT',
        section: 'A',
        year: 1,
        durationMinutes: -10,
        systemCode: 'PC-01',
      });
      expect(negativeRes.status).toBe(422);

      const excessiveRes = await request.post('/api/sessions').send({
        localId: 'sess_max_dur',
        registrationNo: 'REG_TEST_02',
        name: 'Test Student',
        department: 'IT',
        section: 'A',
        year: 1,
        durationMinutes: 9999,
        systemCode: 'PC-01',
      });
      expect(excessiveRes.status).toBe(422);
    });
  });

  describe('2. JWT Authentication & Token Security', () => {
    it('should reject forged/tampered JWT tokens with 401', async () => {
      const forgedToken = jwt.sign(
        { userId: 'user-admin', role: 'ADMIN' },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );

      const res = await request
        .get('/api/users')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired JWT tokens with 401', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-admin', role: 'ADMIN' },
        config.jwt.secret,
        { expiresIn: '-1s' }
      );

      const res = await request
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('3. Role-Based Access Control (RBAC) Hardening', () => {
    it('User Management (/api/users) -> ONLY Admin can access, Faculty/Staff get 403', async () => {
      const adminRes = await request
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);

      const facultyRes = await request
        .get('/api/users')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(facultyRes.status).toBe(403);

      const staffRes = await request
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(staffRes.status).toBe(403);
    });

    it('Timetable Management (/api/timetable POST/PUT/DELETE) -> ONLY Admin can modify', async () => {
      const facultyPost = await request
        .post('/api/timetable')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          department: 'IT',
          section: 'A',
          year: 1,
          subject: 'Programming',
          facultyName: 'Dr. D. Sathya',
        });
      expect(facultyPost.status).toBe(403);

      const staffPost = await request
        .post('/api/timetable')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          endTime: '10:00',
          department: 'IT',
          section: 'A',
          year: 1,
          subject: 'Programming',
          facultyName: 'Dr. D. Sathya',
        });
      expect(staffPost.status).toBe(403);
    });
  });

  describe('4. Timing Field Confidentiality (Faculty / Non-Teaching Staff Restriction)', () => {
    it('Faculty MUST NOT see startTime, expectedEndTime, or actualEndTime in sessions or presence', async () => {
      // Start a session
      await request.post('/api/attendance').send({
        registerNumber: '732224IT005',
        studentName: 'Alice',
        systemNumber: 'PC-05',
        sessionId: 'sess_conf_01',
      });

      // Faculty requests sessions list
      const sessRes = await request
        .get('/api/sessions')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(sessRes.status).toBe(200);
      const session = sessRes.body.data[0];
      expect(session).toBeDefined();
      expect(session.startTime).toBeUndefined();
      expect(session.expectedEndTime).toBeUndefined();
      expect(session.actualEndTime).toBeUndefined();

      // Faculty requests student presence
      const presRes = await request
        .get('/api/students/presence')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(presRes.status).toBe(200);
      expect(presRes.body.data.length).toBeGreaterThanOrEqual(1);
      const item = presRes.body.data[0];
      expect(item.startTime).toBeUndefined();
      expect(item.expectedEndTime).toBeUndefined();
    });

    it('Admin MUST see all timing fields for auditing', async () => {
      // Start a session
      await request.post('/api/attendance').send({
        registerNumber: '732224IT006',
        studentName: 'Bob',
        systemNumber: 'PC-06',
        sessionId: 'sess_conf_02',
      });

      const adminRes = await request
        .get('/api/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      const session = adminRes.body.data[0];
      expect(session.startTime).toBeDefined();
      expect(session.expectedEndTime).toBeDefined();
    });
  });
});
