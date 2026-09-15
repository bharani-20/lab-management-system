'use strict';

const { prisma } = require('../config/database');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * Get sessions report with filters and pagination.
 */
async function getSessionsReport(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { from, to, department, section, systemCode, status } = query;

  const where = {};
  if (status) where.status = status;
  if (department) where.departmentSnapshot = { equals: department, mode: 'insensitive' };
  if (section) where.sectionSnapshot = { equals: section, mode: 'insensitive' };
  if (systemCode) where.system = { systemCode: { equals: systemCode, mode: 'insensitive' } };
  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: 'desc' },
      include: {
        student: { select: { registrationNo: true, name: true, department: true, section: true, year: true } },
        system: { select: { systemCode: true } },
      },
    }),
    prisma.session.count({ where }),
  ]);

  return { sessions, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Get attendance report with filters.
 */
async function getAttendanceReport(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { from, to, department, section } = query;

  const studentFilter = {};
  if (department) studentFilter.department = { equals: department, mode: 'insensitive' };
  if (section) studentFilter.section = { equals: section, mode: 'insensitive' };

  const where = {};
  if (Object.keys(studentFilter).length > 0) where.student = studentFilter;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        student: { select: { registrationNo: true, name: true, department: true, section: true, year: true } },
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return { attendance: records, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * System usage report — sessions per system.
 */
async function getSystemUsageReport(query = {}) {
  const { from, to } = query;

  const where = {};
  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const usage = await prisma.session.groupBy({
    by: ['systemId'],
    where,
    _count: { _all: true },
    _avg: { durationMinutes: true },
    orderBy: { _count: { systemId: 'desc' } },
  });

  // Enrich with system details
  const systemIds = usage.map((u) => u.systemId);
  const systems = await prisma.system.findMany({
    where: { id: { in: systemIds } },
    select: { id: true, systemCode: true, hostname: true },
  });
  const systemMap = Object.fromEntries(systems.map((s) => [s.id, s]));

  const result = usage.map((u) => ({
    system: systemMap[u.systemId] || { id: u.systemId, systemCode: 'Unknown' },
    sessionCount: u._count._all,
    avgDurationMinutes: Math.round(u._avg.durationMinutes || 0),
  }));

  return { systems: result, usage: result };
}

/**
 * Student usage report — sessions per student.
 */
async function getStudentUsageReport(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { from, to, department, section } = query;

  const where = {};
  if (department) where.departmentSnapshot = { equals: department, mode: 'insensitive' };
  if (section) where.sectionSnapshot = { equals: section, mode: 'insensitive' };
  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from);
    if (to) where.startTime.lte = new Date(to);
  }

  const usage = await prisma.session.groupBy({
    by: ['studentId', 'registrationNoSnapshot', 'nameSnapshot', 'departmentSnapshot', 'sectionSnapshot', 'yearSnapshot'],
    where,
    _count: { _all: true },
    _sum: { durationMinutes: true },
    orderBy: { _count: { studentId: 'desc' } },
  });

  const total = usage.length;
  const paginated = usage.slice(skip, skip + limit);

  const result = paginated.map((u) => ({
    studentId: u.studentId,
    registrationNo: u.registrationNoSnapshot,
    name: u.nameSnapshot,
    department: u.departmentSnapshot,
    section: u.sectionSnapshot,
    year: u.yearSnapshot,
    sessionCount: u._count._all,
    totalMinutes: u._sum.durationMinutes || 0,
  }));

  return {
    students: result,
    usage: result,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

module.exports = { getSessionsReport, getAttendanceReport, getSystemUsageReport, getStudentUsageReport };
