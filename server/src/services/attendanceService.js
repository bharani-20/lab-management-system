'use strict';

const { prisma } = require('../config/database');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * Get attendance records with filters and pagination.
 */
async function listAttendance(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { date, department, section, year, studentId, status } = query;

  const where = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;

  if (date) {
    const d = new Date(date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.date = { gte: d, lt: next };
  }

  if (department || section || year) {
    where.student = {};
    if (department) where.student.department = { equals: department, mode: 'insensitive' };
    if (section) where.student.section = { equals: section, mode: 'insensitive' };
    if (year) where.student.year = parseInt(year, 10);
  }

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: { select: { id: true, registrationNo: true, name: true, department: true, section: true, year: true } },
        session: { select: { id: true, startTime: true, actualEndTime: true, system: { select: { systemCode: true } } } },
      },
    }),
    prisma.attendance.count({ where }),
  ]);

  return {
    attendances: records,
    attendance: records,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Record attendance for a student on a specific date.
 * Supports both object payload and positional arguments.
 * Upserts to avoid duplicate entries for the same student+date.
 */
async function recordAttendance(studentIdOrData, date, status, sessionId = null) {
  let sId = studentIdOrData;
  let dVal = date;
  let st = status;
  let sessId = sessionId;

  if (studentIdOrData && typeof studentIdOrData === 'object') {
    sId = studentIdOrData.studentId;
    dVal = studentIdOrData.date;
    st = studentIdOrData.status;
    sessId = studentIdOrData.sessionId || null;
  }

  const d = new Date(dVal || Date.now());
  d.setHours(0, 0, 0, 0);

  return prisma.attendance.upsert({
    where: { studentId_date: { studentId: sId, date: d } },
    update: { status: st, sessionId: sessId },
    create: { studentId: sId, date: d, status: st, sessionId: sessId },
  });
}

module.exports = { listAttendance, recordAttendance };
