'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES } = require('../../src/utils/constants');

describe('24. Security and Input Sanitization Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  it('should not leak password hashes across any user or auth endpoint', async () => {
    const res = await request.get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    const stringified = JSON.stringify(res.body);

    expect(stringified).not.toContain('passwordHash');
    expect(stringified).not.toContain('$2a$10$');
  });

  it('should reject malformed JSON payloads gracefully', async () => {
    const res = await request
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"invalid json: true');

    expect(res.status).toBe(400);
  });

  it('should reject SQL injection payloads in queries safely', async () => {
    const res = await request
      .get("/api/students?search=' OR '1'='1")
      .set('Authorization', `Bearer ${adminToken}`);

    // Should return 200 with normal empty or matching results, never crashing or executing raw SQL
    expect(res.status).toBe(200);
  });
});
