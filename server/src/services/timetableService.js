'use strict';

const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

/**
 * List timetable entries with optional filters.
 */
async function listTimetable(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { dayOfWeek, department, section, year } = query;

  const where = {};
  if (dayOfWeek) where.dayOfWeek = dayOfWeek.toUpperCase();
  if (department) where.department = { equals: department, mode: 'insensitive' };
  if (section) where.section = { equals: section, mode: 'insensitive' };
  if (year) where.year = parseInt(year, 10);

  const [entries, total] = await Promise.all([
    prisma.timetable.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.timetable.count({ where }),
  ]);

  return {
    timetables: entries,
    timetable: entries,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Create a timetable entry.
 */
async function createTimetableEntry(data, createdBy) {
  return prisma.timetable.create({
    data: { ...data, createdBy },
  });
}

/**
 * Update a timetable entry.
 */
async function updateTimetableEntry(id, data) {
  const entry = await prisma.timetable.findUnique({ where: { id } });
  if (!entry) throw createError('Timetable entry not found.', 404, 'TIMETABLE_NOT_FOUND');
  return prisma.timetable.update({ where: { id }, data });
}

/**
 * Delete a timetable entry.
 */
async function deleteTimetableEntry(id) {
  const entry = await prisma.timetable.findUnique({ where: { id } });
  if (!entry) throw createError('Timetable entry not found.', 404, 'TIMETABLE_NOT_FOUND');
  return prisma.timetable.delete({ where: { id } });
}

module.exports = {
  listTimetable,
  listTimetables: listTimetable,
  createTimetableEntry,
  createTimetable: createTimetableEntry,
  updateTimetableEntry,
  updateTimetable: updateTimetableEntry,
  deleteTimetableEntry,
  deleteTimetable: deleteTimetableEntry,
};
