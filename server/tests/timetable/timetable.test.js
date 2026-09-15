'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('18. Timetable Automation Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  describe('GET /api/timetable', () => {
    it('should list timetable entries for authenticated users', async () => {
      const res = await request.get('/api/timetable').set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/timetable', () => {
    it('should allow ADMIN to create valid timetable entry', async () => {
      const payload = {
        dayOfWeek: 'TUESDAY',
        startTime: '10:00',
        endTime: '12:00',
        department: 'Computer Science',
        section: 'B',
        year: 2,
        subject: 'Data Structures Lab',
        facultyName: 'Dr. Jane Smith',
        room: 'Lab 2',
      };

      const res = await request
        .post('/api/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject(payload);
    });

    it('should reject timetable entry when startTime >= endTime', async () => {
      const invalidPayload = {
        dayOfWeek: 'WEDNESDAY',
        startTime: '14:00',
        endTime: '13:00', // Invalid: end is before start
        department: 'Computer Science',
        section: 'A',
        year: 3,
        subject: 'Networking Lab',
        facultyName: 'Dr. John Faculty',
      };

      const res = await request
        .post('/api/timetable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('success', false);
    });
  });
});
