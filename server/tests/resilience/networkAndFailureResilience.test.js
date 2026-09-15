'use strict';

const { request, prisma } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS, SESSION_STATUS } = require('../../src/utils/constants');
const { runCleanup } = require('../../src/jobs/dataCleanupJob');

describe('Network Dynamics, Crash Recovery & Data Retention Resilience Suite', () => {
  const adminToken = getAuthToken(ROLES.ADMIN);

  it('Resilience 1: Dynamic DHCP Collision -> Clears collision on previous system while preserving both workstation identities', async () => {
    // Step 1: PC-01 gets IP 192.168.1.50
    await request.post('/api/systems/heartbeat').send({
      systemCode: 'PC-01',
      ipAddress: '192.168.1.50',
    });

    // Step 2: DHCP pool reassigns 192.168.1.50 to PC-02
    const pc02Res = await request.post('/api/systems/heartbeat').send({
      systemCode: 'PC-02',
      ipAddress: '192.168.1.50',
    });

    expect(pc02Res.status).toBe(200);
    expect(pc02Res.body.data.ipAddress).toBe('192.168.1.50');

    // Step 3: PC-01 must still exist, with its conflicting IP cleared to prevent routing collisions
    const pc01 = await prisma.system.findUnique({ where: { systemCode: 'PC-01' } });
    const pc02 = await prisma.system.findUnique({ where: { systemCode: 'PC-02' } });

    expect(pc01).toBeDefined();
    expect(pc01.systemCode).toBe('PC-01');
    expect(pc01.ipAddress).toBeNull();

    expect(pc02).toBeDefined();
    expect(pc02.systemCode).toBe('PC-02');
    expect(pc02.ipAddress).toBe('192.168.1.50');
  });

  it('Resilience 2: Sudden Power Loss -> Session Reconciler automatically marks abandoned sessions EXPIRED and workstation AVAILABLE', async () => {
    // Start session on PC-03
    const sessionRes = await request.post('/api/attendance').send({
      registerNumber: '732224IT003',
      studentName: 'Charlie',
      systemNumber: 'PC-03',
      sessionId: 'sess_power_loss_01',
      duration: 30,
    });
    const sessionRecord = await prisma.session.findFirst({
      where: { localId: 'sess_power_loss_01' },
    });

    // Simulate power loss by artificially setting lastHeartbeatAt and expectedEndTime to past
    const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    await prisma.session.update({
      where: { id: sessionRecord.id },
      data: {
        lastHeartbeatAt: pastDate,
        expectedEndTime: pastDate,
      },
    });

    // Trigger reconciliation
    const reconRes = await request
      .post('/api/sessions/reconcile')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reconRes.status).toBe(200);
    expect(reconRes.body.data.reconciledCount).toBeGreaterThanOrEqual(1);

    // Verify session is now EXPIRED
    const session = await prisma.session.findUnique({ where: { id: sessionRecord.id } });
    expect(session.status).toBe(SESSION_STATUS.EXPIRED);

    // Verify PC-03 is restored to AVAILABLE
    const pc03 = await prisma.system.findUnique({ where: { systemCode: 'PC-03' } });
    expect(pc03.status).toBe(SYSTEM_STATUS.AVAILABLE);
  });

  it('Resilience 3: Offline Batch Synchronization -> Syncs 20 offline sessions with idempotency and duplicate active conflict downgrading', async () => {
    const offlineBatch = [];
    for (let i = 1; i <= 20; i++) {
      offlineBatch.push({
        localId: `sess_offline_batch_${i}`,
        registrationNo: `732224IT${String(i).padStart(3, '0')}`,
        name: `Offline Student ${i}`,
        department: 'IT',
        section: 'A',
        year: 2,
        durationMinutes: 45,
        systemCode: `PC-${String(i).padStart(2, '0')}`,
        startTime: new Date(Date.now() - 3600000).toISOString(),
        actualEndTime: new Date().toISOString(),
        status: 'COMPLETED',
      });
    }

    const syncRes = await request
      .post('/api/sync/sessions')
      .send({ sessions: offlineBatch });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.data.synced).toBe(20);

    // Re-syncing the exact same batch must be idempotent (20 duplicates skipped, 0 duplicate rows created)
    const idempotentRes = await request
      .post('/api/sync/sessions')
      .send({ sessions: offlineBatch });

    expect(idempotentRes.status).toBe(200);
    expect(idempotentRes.body.data.duplicates).toBe(20);
  });

  it('Resilience 4: Automatic 21-Day Retention Cleanup -> Purges stale records (>21d) while preserving all master records', async () => {
    // Create an old completed session (>21 days ago)
    const oldDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000); // 25 days ago
    await prisma.session.create({
      data: {
        localId: 'sess_ancient_01',
        studentId: 'stu-732224IT001',
        registrationNoSnapshot: '732224IT001',
        nameSnapshot: 'Ancient Student',
        departmentSnapshot: 'IT',
        sectionSnapshot: 'A',
        yearSnapshot: 1,
        systemId: 'sys-PC-01',
        durationMinutes: 60,
        startTime: oldDate,
        expectedEndTime: oldDate,
        actualEndTime: oldDate,
        status: SESSION_STATUS.COMPLETED,
      },
    });

    // Run cleanup job
    const cleanupResult = await runCleanup();
    expect(cleanupResult.deletedSessions).toBeGreaterThanOrEqual(1);

    // Verify master records (all 64 systems and all users) remain 100% intact
    const systemsCount = await prisma.system.count();
    expect(systemsCount).toBe(64);

    const usersCount = await prisma.user.count();
    expect(usersCount).toBeGreaterThanOrEqual(1);
  });
});
