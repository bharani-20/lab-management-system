'use strict';

const { request } = require('../setup/testServer');
const { getAuthToken } = require('../setup/testData');
const { ROLES, SYSTEM_STATUS, SESSION_STATUS } = require('../../src/utils/constants');

describe('Comprehensive Concurrency & High-Load Stress Automation Suite', () => {
  it('Stress 1: 64 Simultaneous Student Logins across all 64 Workstations in parallel', async () => {
    // 64 distinct students logging into PC-01 through PC-64 at the exact same time
    const loginPromises = [];

    for (let i = 1; i <= 64; i++) {
      const pcCode = `PC-${String(i).padStart(2, '0')}`;
      const regNo = `732224IT${String(i).padStart(3, '0')}`;
      const studentName = `Student ${i}`;

      loginPromises.push(
        request.post('/api/attendance').send({
          registerNumber: regNo,
          studentName: studentName,
          systemNumber: pcCode,
          sessionId: `sess_stress_${i}`,
          department: 'IT',
          section: i <= 32 ? 'A' : 'B',
          year: 3,
          duration: 60,
        })
      );
    }

    const results = await Promise.all(loginPromises);

    // All 64 logins must succeed with 201 Created
    for (let i = 0; i < 64; i++) {
      expect(results[i].status).toBe(201);
      expect(results[i].body.success).toBe(true);
      expect(results[i].body.data.status).toBe(SESSION_STATUS.ACTIVE);
    }

    // Verify all 64 systems are now ACTIVE
    const systemsRes = await request.get('/api/systems?limit=100');
    expect(systemsRes.status).toBe(200);
    const activeCount = systemsRes.body.data.filter((s) => s.status === SYSTEM_STATUS.ACTIVE).length;
    expect(activeCount).toBe(64);
  });

  it('Stress 2: Race Condition Burst -> 10 Simultaneous Parallel Logins for the SAME Student across 10 Different PCs', async () => {
    // Exact same student fires 10 simultaneous login requests across PC-01 to PC-10
    const targetRegNo = '732224IT999';
    const burstPromises = [];

    for (let i = 1; i <= 10; i++) {
      const pcCode = `PC-${String(i).padStart(2, '0')}`;
      burstPromises.push(
        request.post('/api/attendance').send({
          registerNumber: targetRegNo,
          studentName: 'Race Condition Student',
          systemNumber: pcCode,
          sessionId: `sess_race_student_${i}`,
          duration: 60,
        })
      );
    }

    const results = await Promise.all(burstPromises);

    const successCount = results.filter((r) => r.status === 201).length;
    const rejectedCount = results.filter((r) => r.status === 409).length;

    // EXACTLY 1 must win and succeed (201), the other 9 MUST be rejected (409 Invalid User)
    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(9);

    const rejectedResponses = results.filter((r) => r.status === 409);
    for (const res of rejectedResponses) {
      expect(res.body.message).toBe('Invalid User');
      expect(res.body.error.code).toBe('STUDENT_ALREADY_ACTIVE');
    }
  });

  it('Stress 3: Race Condition Burst -> 10 Different Students Simultaneous Parallel Logins for the SAME Workstation (PC-01)', async () => {
    // 10 different students compete for PC-01 at the exact same millisecond
    const burstPromises = [];

    for (let i = 1; i <= 10; i++) {
      const regNo = `732224IT80${i}`;
      burstPromises.push(
        request.post('/api/attendance').send({
          registerNumber: regNo,
          studentName: `Competitor Student ${i}`,
          systemNumber: 'PC-01',
          sessionId: `sess_race_pc_${i}`,
          duration: 60,
        })
      );
    }

    const results = await Promise.all(burstPromises);

    const successCount = results.filter((r) => r.status === 201).length;
    const rejectedCount = results.filter((r) => r.status === 409).length;

    // EXACTLY 1 must claim the PC (201), the other 9 MUST be rejected (409 SYSTEM_BUSY)
    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(9);

    const rejectedResponses = results.filter((r) => r.status === 409);
    for (const res of rejectedResponses) {
      expect(res.body.error.code).toBe('SYSTEM_BUSY');
    }
  });

  it('Stress 4: 64 Simultaneous System Heartbeat Storm with Dynamic DHCP IPs', async () => {
    const heartbeatPromises = [];

    for (let i = 1; i <= 64; i++) {
      const pcCode = `PC-${String(i).padStart(2, '0')}`;
      const dynamicIp = `192.168.10.${100 + i}`;

      heartbeatPromises.push(
        request.post('/api/systems/heartbeat').send({
          systemCode: pcCode,
          hostname: `HOST-${pcCode}`,
          ipAddress: dynamicIp,
        })
      );
    }

    const results = await Promise.all(heartbeatPromises);

    for (let i = 0; i < 64; i++) {
      expect(results[i].status).toBe(200);
      expect(results[i].body.success).toBe(true);
      expect(results[i].body.data.ipAddress).toBe(`192.168.10.${100 + (i + 1)}`);
    }
  });
});
