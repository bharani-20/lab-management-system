'use strict';

const { request, prisma } = require('../setup/testServer');

describe('16. Session Heartbeat Tests', () => {
  beforeEach(async () => {
    await request.post('/api/sessions').send({
      localId: 'loc-hb-001',
      registrationNo: 'REG2026001',
      name: 'Alice Johnson',
      department: 'Computer Science',
      section: 'A',
      year: 3,
      durationMinutes: 60,
      systemCode: 'PC-08',
    });
  });

  it('POST /api/sessions/heartbeat should update lastHeartbeatAt and system lastSeenAt', async () => {
    const res = await request.post('/api/sessions/heartbeat').send({
      systemCode: 'PC-08',
      localId: 'loc-hb-001',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const dbSession = await prisma.session.findUnique({ where: { localId: 'loc-hb-001' } });
    expect(dbSession.lastHeartbeatAt).toBeDefined();

    const dbSystem = await prisma.system.findUnique({ where: { systemCode: 'PC-08' } });
    expect(dbSystem.lastSeenAt).toBeDefined();
  });

  it('POST /api/sessions/heartbeat should return 404 for unknown systemCode', async () => {
    const res = await request.post('/api/sessions/heartbeat').send({
      systemCode: 'UNKNOWN-PC',
      localId: 'loc-hb-001',
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty('code', 'SYSTEM_NOT_FOUND');
  });
});
