'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS, SESSION_STATUS } = require('../../src/utils/constants');

describe('9 & 14. Session Lifecycle and System Conflict Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  const sampleSessionPayload = {
    localId: 'loc-sess-001',
    registrationNo: 'REG2026001',
    name: 'Alice Johnson',
    department: 'Computer Science',
    section: 'A',
    year: 3,
    durationMinutes: 60,
    systemCode: 'PC-01',
  };

  it('Step 1: Start a valid session -> PC-01 becomes ACTIVE', async () => {
    const res = await request.post('/api/sessions').send(sampleSessionPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('status', SESSION_STATUS.ACTIVE);
    expect(res.body.data).toHaveProperty('durationMinutes', 60);

    // Verify PC-01 status in database/API is now ACTIVE
    const sysRes = await request.get('/api/systems/sys-PC-01');
    expect(sysRes.body.data.status).toBe(SYSTEM_STATUS.ACTIVE);
  });

  it('Step 2: Conflict rejection -> Attempt second session on PC-01 while busy returns 409 SYSTEM_BUSY', async () => {
    // Session is already active on PC-01
    await request.post('/api/sessions').send(sampleSessionPayload);

    const conflictingPayload = {
      localId: 'loc-sess-002',
      registrationNo: 'REG2026002',
      name: 'Bob Smith',
      department: 'IT',
      section: 'B',
      year: 2,
      durationMinutes: 45,
      systemCode: 'PC-01',
    };

    const res = await request.post('/api/sessions').send(conflictingPayload);
    expect(res.status).toBe(409);
    expect(res.body.error).toHaveProperty('code', 'SYSTEM_BUSY');
  });

  it('Step 3: End session -> status becomes COMPLETED and PC-01 becomes AVAILABLE', async () => {
    const startRes = await request.post('/api/sessions').send(sampleSessionPayload);
    const sessionId = startRes.body.data.id;

    const endRes = await request.patch(`/api/sessions/${sessionId}/end`);
    expect(endRes.status).toBe(200);
    expect(endRes.body.data.status).toBe(SESSION_STATUS.COMPLETED);

    // Verify PC-01 is AVAILABLE again
    const sysRes = await request.get('/api/systems/sys-PC-01');
    expect(sysRes.body.data.status).toBe(SYSTEM_STATUS.AVAILABLE);
  });

  it('Step 4: Attempt session on PC under MAINTENANCE returns 409 SYSTEM_MAINTENANCE', async () => {
    // Put PC-05 under maintenance
    await request
      .put('/api/systems/sys-PC-05')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: SYSTEM_STATUS.MAINTENANCE });

    const res = await request.post('/api/sessions').send({
      ...sampleSessionPayload,
      localId: 'loc-sess-005',
      systemCode: 'PC-05',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toHaveProperty('code', 'SYSTEM_MAINTENANCE');
  });
});
