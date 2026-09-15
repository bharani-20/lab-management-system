'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('12. Role-Based Session Timing Visibility Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);
  const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

  let createdSessionId;

  beforeEach(async () => {
    const res = await request.post('/api/sessions').send({
      localId: 'loc-vis-001',
      registrationNo: 'REG2026001',
      name: 'Alice Johnson',
      department: 'Computer Science',
      section: 'A',
      year: 3,
      durationMinutes: 60,
      systemCode: 'PC-06',
    });
    createdSessionId = res.body.data.id;
  });

  describe('Direct Session Start / End (Student Client)', () => {
    it('Student Client start response must NOT expose startTime, expectedEndTime, actualEndTime', async () => {
      const res = await request.post('/api/sessions').send({
        localId: 'loc-vis-student',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'IT',
        section: 'B',
        year: 2,
        durationMinutes: 45,
        systemCode: 'PC-07',
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('durationMinutes', 45);
      expect(res.body.data).not.toHaveProperty('startTime');
      expect(res.body.data).not.toHaveProperty('expectedEndTime');
      expect(res.body.data).not.toHaveProperty('actualEndTime');
    });
  });

  describe('GET /api/sessions (List Sessions)', () => {
    it('ADMIN receives full timing details (startTime, expectedEndTime, durationMinutes)', async () => {
      const res = await request.get('/api/sessions').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const session = res.body.data.find((s) => s.id === createdSessionId);
      expect(session).toBeDefined();
      expect(session).toHaveProperty('startTime');
      expect(session).toHaveProperty('expectedEndTime');
      expect(session).toHaveProperty('durationMinutes', 60);
    });

    it('FACULTY response strips startTime, expectedEndTime, and actualEndTime', async () => {
      const res = await request.get('/api/sessions').set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      const session = res.body.data.find((s) => s.id === createdSessionId);
      expect(session).toBeDefined();
      expect(session).not.toHaveProperty('startTime');
      expect(session).not.toHaveProperty('expectedEndTime');
      expect(session).not.toHaveProperty('actualEndTime');
      expect(session).toHaveProperty('durationMinutes', 60);
    });

    it('NON_TEACHING_STAFF response strips startTime, expectedEndTime, and actualEndTime', async () => {
      const res = await request.get('/api/sessions').set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      const session = res.body.data.find((s) => s.id === createdSessionId);
      expect(session).toBeDefined();
      expect(session).not.toHaveProperty('startTime');
      expect(session).not.toHaveProperty('expectedEndTime');
      expect(session).not.toHaveProperty('actualEndTime');
    });
  });

  describe('GET /api/sessions/:id (Single Session Details)', () => {
    it('ADMIN can view single session timing fields', async () => {
      const res = await request
        .get(`/api/sessions/${createdSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('startTime');
      expect(res.body.data).toHaveProperty('expectedEndTime');
    });

    it('FACULTY response omits timing fields on single session', async () => {
      const res = await request
        .get(`/api/sessions/${createdSessionId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('startTime');
      expect(res.body.data).not.toHaveProperty('expectedEndTime');
      expect(res.body.data).not.toHaveProperty('actualEndTime');
    });
  });
});
