'use strict';

const reportService = require('../services/reportService');
const { sendSuccess } = require('../utils/response');
const { serializeSession } = require('../utils/sessionSerializer');

async function getSessionsReport(req, res, next) {
  try {
    const userRole = req.user ? req.user.role : 'ADMIN';
    const result = await reportService.getSessionsReport(req.query);
    result.sessions = serializeSession(result.sessions, userRole);
    return sendSuccess(res, result.sessions, 'Sessions report retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getAttendanceReport(req, res, next) {
  try {
    const result = await reportService.getAttendanceReport(req.query);
    return sendSuccess(res, result.attendances, 'Attendance report retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getSystemUsageReport(req, res, next) {
  try {
    const result = await reportService.getSystemUsageReport(req.query);
    return sendSuccess(res, result.systems, 'System usage report retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getStudentUsageReport(req, res, next) {
  try {
    const result = await reportService.getStudentUsageReport(req.query);
    return sendSuccess(res, result.students, 'Student usage report retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSessionsReport,
  getAttendanceReport,
  getSystemUsageReport,
  getStudentUsageReport,
};
