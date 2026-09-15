'use strict';

const { prisma, resetDatabase } = require('../setup/testServer');
const { runCleanup, startCleanupJob } = require('../../src/jobs/dataCleanupJob');
const { SESSION_STATUS, ATTENDANCE_STATUS } = require('../../src/utils/constants');

describe('27. 21-Day Cleanup Job Tests', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('should start cleanup cron job without errors', () => {
    const job = startCleanupJob();
    expect(job).toBeDefined();
    if (job && typeof job.stop === 'function') {
      job.stop();
    }
  });

  it('should retain 20-day-old records and delete 22-day-old historical records based on exact cutoff semantics', async () => {
    const now = new Date();
    const day22Ago = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000); // 22 days ago (eligible)
    const day20Ago = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago (must retain)

    // Old 22-day completed session
    await prisma.session.create({
      data: {
        localId: 'loc-old-22d',
        studentId: 'stu-001',
        registrationNoSnapshot: 'REG2026001',
        nameSnapshot: 'Alice Johnson',
        departmentSnapshot: 'Computer Science',
        sectionSnapshot: 'A',
        yearSnapshot: 3,
        systemId: 'sys-PC-01',
        durationMinutes: 60,
        startTime: day22Ago,
        expectedEndTime: new Date(day22Ago.getTime() + 60 * 60 * 1000),
        actualEndTime: new Date(day22Ago.getTime() + 55 * 60 * 1000),
        status: SESSION_STATUS.COMPLETED,
      },
    });

    // 20-day-old completed session (within 21-day retention window)
    await prisma.session.create({
      data: {
        localId: 'loc-retain-20d',
        studentId: 'stu-001',
        registrationNoSnapshot: 'REG2026001',
        nameSnapshot: 'Alice Johnson',
        departmentSnapshot: 'Computer Science',
        sectionSnapshot: 'A',
        yearSnapshot: 3,
        systemId: 'sys-PC-02',
        durationMinutes: 60,
        startTime: day20Ago,
        expectedEndTime: new Date(day20Ago.getTime() + 60 * 60 * 1000),
        actualEndTime: new Date(day20Ago.getTime() + 55 * 60 * 1000),
        status: SESSION_STATUS.COMPLETED,
      },
    });

    // 25-day-old active session (safety: must preserve ACTIVE status even if old)
    await prisma.session.create({
      data: {
        localId: 'loc-active-old',
        studentId: 'stu-002',
        registrationNoSnapshot: 'REG2026002',
        nameSnapshot: 'Bob Smith',
        departmentSnapshot: 'Computer Science',
        sectionSnapshot: 'A',
        yearSnapshot: 3,
        systemId: 'sys-PC-03',
        durationMinutes: 120,
        startTime: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        expectedEndTime: new Date(now.getTime() + 60 * 60 * 1000),
        status: SESSION_STATUS.ACTIVE,
      },
    });

    // Old attendance record (22 days old)
    await prisma.attendance.create({
      data: {
        id: 'att-old-22d',
        studentId: 'stu-001',
        date: day22Ago,
        status: ATTENDANCE_STATUS.PRESENT,
        createdAt: day22Ago,
      },
    });

    // Run cleanup
    const result = await runCleanup();
    expect(result.deletedSessions).toBe(1);
    expect(result.deletedAttendance).toBe(1);

    // 22-day-old session deleted
    const oldSession = await prisma.session.findUnique({ where: { localId: 'loc-old-22d' } });
    expect(oldSession).toBeNull();

    // 20-day-old session preserved
    const retain20dSession = await prisma.session.findUnique({ where: { localId: 'loc-retain-20d' } });
    expect(retain20dSession).not.toBeNull();

    // Active old session preserved
    const activeOldSession = await prisma.session.findUnique({ where: { localId: 'loc-active-old' } });
    expect(activeOldSession).not.toBeNull();

    // Master data strictly preserved
    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(3);

    const studentCount = await prisma.student.count();
    expect(studentCount).toBeGreaterThanOrEqual(2);

    const systemCount = await prisma.system.count();
    expect(systemCount).toBe(64);

    const timetableCount = await prisma.timetable.count();
    expect(timetableCount).toBeGreaterThanOrEqual(1);
  });
});
