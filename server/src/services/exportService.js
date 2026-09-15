'use strict';

const ExcelJS = require('exceljs');
const { prisma } = require('../config/database');

/**
 * Generate a real .xlsx file for the sessions export.
 * Streams the workbook directly to the Express response.
 *
 * @param {object} query - Filter options: from, to, department, section, systemCode, status
 * @param {import('express').Response} res - Express response to stream into
 */
async function exportSessionsToExcel(query, res) {
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

  const sessions = await prisma.session.findMany({
    where,
    orderBy: { startTime: 'desc' },
    include: { system: { select: { systemCode: true } } },
  });

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lab Management System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Sessions', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // ── Header styling ─────────────────────────────────────────────────────────

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }, // Blue
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const headerAlignment = { horizontal: 'center', vertical: 'middle' };

  // ── Columns ────────────────────────────────────────────────────────────────

  sheet.columns = [
    { header: 'Registration Number', key: 'registrationNo', width: 22 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Section', key: 'section', width: 10 },
    { header: 'Year', key: 'year', width: 8 },
    { header: 'System', key: 'system', width: 12 },
    { header: 'Start Time', key: 'startTime', width: 22 },
    { header: 'Expected End Time', key: 'expectedEndTime', width: 22 },
    { header: 'Actual End Time', key: 'actualEndTime', width: 22 },
    { header: 'Duration (min)', key: 'duration', width: 15 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Sync Source', key: 'syncSource', width: 16 },
  ];

  // Style header row
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = headerAlignment;
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  sheet.getRow(1).height = 20;

  // ── Data rows ──────────────────────────────────────────────────────────────

  const dateFormat = 'DD/MM/YYYY HH:mm:ss';

  sessions.forEach((s, idx) => {
    const row = sheet.addRow({
      registrationNo: s.registrationNoSnapshot,
      name: s.nameSnapshot,
      department: s.departmentSnapshot,
      section: s.sectionSnapshot,
      year: s.yearSnapshot,
      system: s.system?.systemCode || '',
      startTime: s.startTime ? s.startTime.toLocaleString('en-IN') : '',
      expectedEndTime: s.expectedEndTime ? s.expectedEndTime.toLocaleString('en-IN') : '',
      actualEndTime: s.actualEndTime ? s.actualEndTime.toLocaleString('en-IN') : '-',
      duration: s.durationMinutes,
      status: s.status,
      syncSource: s.syncSource,
    });

    // Alternate row shading
    if (idx % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      });
    }

    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle' };
    });
  });

  // ── Auto-filter ────────────────────────────────────────────────────────────
  sheet.autoFilter = { from: 'A1', to: 'L1' };

  // ── Set response headers ───────────────────────────────────────────────────
  const filename = `sessions-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Stream workbook directly to response
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { exportSessionsToExcel, exportSessions: exportSessionsToExcel };
