'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('22. Excel Export Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  it('GET /api/export/sessions should stream valid Excel spreadsheet (.xlsx)', async () => {
    const res = await request
      .get('/api/export/sessions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('sessions-export-');
    expect(res.body).toBeDefined();
  });

  it('GET /api/export/sessions should return 401 when unauthenticated', async () => {
    const res = await request.get('/api/export/sessions');
    expect(res.status).toBe(401);
  });
});
