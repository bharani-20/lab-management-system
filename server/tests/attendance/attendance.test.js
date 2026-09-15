'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('19. Attendance API Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  it('POST /api/attendance should record attendance and prevent duplicate on same day', async () => {
    const payload = {
      studentId: 'stu-001',
      date: new Date('2026-09-11').toISOString(),
      status: 'PRESENT',
    };

    // First record
    const res1 = await request
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body).toHaveProperty('success', true);

    // Second record on same day updates/upserts without duplicating
    const res2 = await request
      .post('/api/attendance')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ ...payload, status: 'LATE' });

    expect(res2.status).toBe(201);
    expect(res2.body.data.status).toBe('LATE');
  });

  it('GET /api/attendance should list attendance records', async () => {
    const res = await request.get('/api/attendance').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
