'use strict';

const { prisma } = require('../config/database');

/**
 * Get admin dashboard statistics.
 * ADMIN ONLY.
 */
async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Run all queries in parallel for performance
  const [
    systemCounts,
    activeSessions,
    todaySessions,
    todayUniqueStudents,
    pendingSyncCount,
    totalStudents,
  ] = await Promise.all([
    // System status counts
    prisma.system.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),

    // Currently active sessions
    prisma.session.count({ where: { status: 'ACTIVE' } }),

    // Today's total sessions
    prisma.session.count({
      where: { startTime: { gte: todayStart, lt: todayEnd } },
    }),

    // Today's unique students
    prisma.session.findMany({
      where: { startTime: { gte: todayStart, lt: todayEnd } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),

    // Offline synced sessions in last 24h (pending attention)
    prisma.session.count({
      where: {
        syncSource: 'OFFLINE_SYNC',
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),

    // Total students
    prisma.student.count(),
  ]);

  // Build system status map
  const systemStatusMap = { AVAILABLE: 0, ACTIVE: 0, OFFLINE: 0, MAINTENANCE: 0 };
  let totalSystems = 0;
  for (const group of systemCounts) {
    systemStatusMap[group.status] = group._count._all;
    totalSystems += group._count._all;
  }

  return {
    systems: {
      total: totalSystems,
      available: systemStatusMap.AVAILABLE,
      active: systemStatusMap.ACTIVE,
      offline: systemStatusMap.OFFLINE,
      maintenance: systemStatusMap.MAINTENANCE,
    },
    sessions: {
      active: activeSessions,
      today: todaySessions,
    },
    students: {
      total: totalStudents,
      todayUnique: todayUniqueStudents.length,
    },
    sync: {
      pendingReview: pendingSyncCount,
    },
    generatedAt: now.toISOString(),
  };
}

module.exports = { getDashboardStats };
