'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('20. Admin Dashboard Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);
  const staffToken = getAuthToken(ROLES.NON_TEACHING_STAFF);

  it('GET /api/dashboard/stats — ADMIN can view stats', async () => {
    const res = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('systems');
    expect(res.body.data).toHaveProperty('sessions');
    expect(res.body.data).toHaveProperty('students');
  });

  it('GET /api/dashboard/stats — FACULTY and STAFF forbidden (403)', async () => {
    const resFaculty = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${facultyToken}`);
    expect(resFaculty.status).toBe(403);

    const resStaff = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${staffToken}`);
    expect(resStaff.status).toBe(403);
  });
});
