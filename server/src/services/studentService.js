'use strict';

const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { serializeSession } = require('../utils/sessionSerializer');

/**
 * List all students with optional filters and pagination.
 */
async function listStudents(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { search, department, section, year } = query;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { registrationNo: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (department) where.department = { equals: department, mode: 'insensitive' };
  if (section) where.section = { equals: section, mode: 'insensitive' };
  if (year) where.year = parseInt(year, 10);

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ department: 'asc' }, { registrationNo: 'asc' }],
    }),
    prisma.student.count({ where }),
  ]);

  return { students, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Get a single student by ID.
 */
async function getStudentById(id) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw createError('Student not found.', 404, 'STUDENT_NOT_FOUND');
  return student;
}

/**
 * Get student presence — currently active sessions enriched with student+system.
 * Enforces timing visibility restriction for FACULTY and NON_TEACHING_STAFF.
 */
async function getStudentPresence(query = {}, userRole = 'ADMIN') {
  const { page, limit, skip } = parsePagination(query);
  const { date, department, section, year, system, status, registrationNo } = query;

  const where = {};

  if (status) {
    where.status = status;
  } else {
    where.status = 'ACTIVE';
  }

  if (date) {
    const d = new Date(date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.startTime = { gte: d, lt: next };
  }

  if (registrationNo) where.registrationNoSnapshot = { contains: registrationNo, mode: 'insensitive' };
  if (department) where.departmentSnapshot = { equals: department, mode: 'insensitive' };
  if (section) where.sectionSnapshot = { equals: section, mode: 'insensitive' };
  if (year) where.yearSnapshot = parseInt(year, 10);

  if (system) {
    where.system = { systemCode: { equals: system, mode: 'insensitive' } };
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: 'desc' },
      include: {
        student: { select: { id: true, registrationNo: true, name: true } },
        system: { select: { id: true, systemCode: true, hostname: true, ipAddress: true } },
      },
    }),
    prisma.session.count({ where }),
  ]);

  const rawPresence = sessions.map((s) => ({
    sessionId: s.id,
    registrationNo: s.registrationNoSnapshot,
    name: s.nameSnapshot,
    department: s.departmentSnapshot,
    section: s.sectionSnapshot,
    year: s.yearSnapshot,
    system: s.system,
    durationMinutes: s.durationMinutes,
    startTime: s.startTime,
    expectedEndTime: s.expectedEndTime,
    actualEndTime: s.actualEndTime,
    status: s.status,
  }));

  const presence = serializeSession(rawPresence, userRole);

  return { presence, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Create a student (Admin only).
 */
async function createStudent(data) {
  const existing = await prisma.student.findUnique({
    where: { registrationNo: data.registrationNo },
  });
  if (existing) {
    throw createError(
      `Student with registrationNo ${data.registrationNo} already exists.`,
      409,
      'DUPLICATE_REGISTRATION_NO'
    );
  }
  return prisma.student.create({ data });
}

/**
 * Update a student (Admin only).
 */
async function updateStudent(id, data) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw createError('Student not found.', 404, 'STUDENT_NOT_FOUND');
  return prisma.student.update({ where: { id }, data });
}

/**
 * Delete a student (Admin only).
 */
async function deleteStudent(id) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw createError('Student not found.', 404, 'STUDENT_NOT_FOUND');
  return prisma.student.delete({ where: { id } });
}

module.exports = { listStudents, getStudentById, getStudentPresence, createStudent, updateStudent, deleteStudent };
