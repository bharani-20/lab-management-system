'use strict';

const { request, prisma } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS, SESSION_STATUS } = require('../../src/utils/constants');

describe('17. Stale Session Reconciliation Tests', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  it('should reconcile stale session past expectedEndTime and restore system to AVAILABLE', async () => {
    // 1. Create a session that expired 10 minutes ago
    const now = new Date();
    const pastStart = new Date(now.getTime() - 70 * 60 * 1000); // 70 min ago
    const pastEnd = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago

    await prisma.session.create({
      data: {
        localId: 'loc-stale-001',
        studentId: 'stu-001',
        registrationNoSnapshot: 'REG2026001',
        nameSnapshot: 'Alice Johnson',
        departmentSnapshot: 'Computer Science',
        sectionSnapshot: 'A',
        yearSnapshot: 3,
        systemId: 'sys-PC-09',
        durationMinutes: 60,
        startTime: pastStart,
        expectedEndTime: pastEnd,
        lastHeartbeatAt: pastStart,
        status: SESSION_STATUS.ACTIVE,
      },
    });

    // Mark system as ACTIVE
    await prisma.system.update({
      where: { id: 'sys-PC-09' },
      data: { status: SYSTEM_STATUS.ACTIVE },
    });

    // 2. Trigger reconciliation
    const res = await request
      .post('/api/sessions/reconcile')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reconciledCount).toBeGreaterThanOrEqual(1);

    // 3. Verify session was marked EXPIRED and actualEndTime was set
    const dbSession = await prisma.session.findUnique({ where: { localId: 'loc-stale-001' } });
    expect(dbSession.status).toBe(SESSION_STATUS.EXPIRED);
    expect(dbSession.actualEndTime).toBeDefined();

    // 4. Verify PC-09 was returned to AVAILABLE
    const dbSystem = await prisma.system.findUnique({ where: { id: 'sys-PC-09' } });
    expect(dbSystem.status).toBe(SYSTEM_STATUS.AVAILABLE);
  });
});
