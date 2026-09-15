'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('21. Report Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);
  const facultyToken = getAuthToken(ROLES.FACULTY);

  it('GET /api/reports/sessions — ADMIN can view sessions report with full timing', async () => {
    const res = await request.get('/api/reports/sessions').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });

  it('GET /api/reports/sessions — FACULTY sessions report has timing fields sanitized', async () => {
    const res = await request.get('/api/reports/sessions').set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).not.toHaveProperty('startTime');
      expect(res.body.data[0]).not.toHaveProperty('expectedEndTime');
    }
  });

  it('GET /api/reports/systems — returns system utilization report', async () => {
    const res = await request.get('/api/reports/systems').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/reports/students — returns student usage report', async () => {
    const res = await request.get('/api/reports/students').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
