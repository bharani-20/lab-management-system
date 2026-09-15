'use strict';

const { request, prisma } = require('../setup/testServer');
const { SYNC_SOURCE } = require('../../src/utils/constants');

describe('15. Offline Session Batch Synchronization Tests', () => {
  const syncBatchPayload = {
    sessions: [
      {
        localId: 'loc-offline-001',
        registrationNo: 'REG2026001',
        name: 'Alice Johnson',
        department: 'Computer Science',
        section: 'A',
        year: 3,
        durationMinutes: 60,
        systemCode: 'PC-10',
        startTime: new Date('2026-09-11T10:00:00.000Z').toISOString(),
        actualEndTime: new Date('2026-09-11T11:00:00.000Z').toISOString(),
        status: 'COMPLETED',
      },
      {
        localId: 'loc-offline-002',
        registrationNo: 'REG2026002',
        name: 'Bob Smith',
        department: 'Information Technology',
        section: 'B',
        year: 2,
        durationMinutes: 45,
        systemCode: 'PC-11',
        startTime: new Date('2026-09-11T10:15:00.000Z').toISOString(),
        status: 'ACTIVE',
      },
    ],
  };

  it('should synchronize offline session batch successfully', async () => {
    const res = await request.post('/api/sync/sessions').send(syncBatchPayload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.synced).toBe(2);

    // Verify records in database
    const s1 = await prisma.session.findUnique({ where: { localId: 'loc-offline-001' } });
    expect(s1).toBeDefined();
    expect(s1.syncSource).toBe(SYNC_SOURCE.OFFLINE_SYNC);

    const s2 = await prisma.session.findUnique({ where: { localId: 'loc-offline-002' } });
    expect(s2).toBeDefined();
  });

  it('Idempotency test: repeated sync with same localId should NOT duplicate sessions', async () => {
    // Sync first time
    await request.post('/api/sync/sessions').send(syncBatchPayload);

    // Sync second time with exact same localIds
    const secondRes = await request.post('/api/sync/sessions').send(syncBatchPayload);
    expect(secondRes.status).toBe(200);

    // Count records in DB with these localIds
    const count = await prisma.session.count({
      where: {
        localId: { in: ['loc-offline-001', 'loc-offline-002'] },
      },
    });

    // Exactly 2 logical sessions exist
    expect(count).toBe(2);
  });
});
