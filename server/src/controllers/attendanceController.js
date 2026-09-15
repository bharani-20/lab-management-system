'use strict';

const attendanceService = require('../services/attendanceService');
const sessionService = require('../services/sessionService');
const { sendSuccess } = require('../utils/response');
const { extractClientIp } = require('../utils/ipHelper');
const { createError } = require('../middleware/errorMiddleware');

/**
 * GET /api/attendance
 * List attendance records with filters & pagination (Protected).
 */
async function listAttendance(req, res, next) {
  try {
    const result = await attendanceService.listAttendance(req.query);
    return sendSuccess(res, result.attendances, 'Attendance records retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/attendance
 * Dual-mode endpoint:
 * 1. Student Kiosk Client: starts lab session & records attendance without JWT.
 * 2. Authenticated Admin/Faculty: records manual attendance.
 */
async function recordAttendance(req, res, next) {
  try {
    // Mode 2: Authenticated user manual attendance record with studentId & date
    if (req.user && req.body.studentId && (req.body.date || req.body.status)) {
      const attendance = await attendanceService.recordAttendance(req.body);
      return sendSuccess(res, attendance, 'Attendance recorded.', 201);
    }

    // Mode 1: Student Client Kiosk payload
    const rawRegNo = req.body.registerNumber || req.body.registrationNo;
    const rawSystemNo = req.body.systemNumber || req.body.systemCode;

    if (!rawRegNo) {
      throw createError('registerNumber or registrationNo is required.', 400, 'VALIDATION_ERROR');
    }
    if (!rawSystemNo) {
      throw createError('systemNumber or systemCode is required.', 400, 'VALIDATION_ERROR');
    }

    const registrationNo = String(rawRegNo).trim().toUpperCase();
    const name = req.body.studentName || req.body.name || req.body.student_name || 'Student';
    const department = req.body.department || 'IT';
    const section = req.body.section || 'A';
    const year = parseInt(req.body.year, 10) || 1;
    const durationMinutes =
      parseInt(req.body.durationMinutes || req.body.duration || req.body.duration_minutes, 10) || 60;
    const localId =
      req.body.sessionId || req.body.localId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const faculty = req.body.faculty || null;

    const clientIp = extractClientIp(req, req.body.ipAddress);

    const session = await sessionService.createSession(
      {
        localId,
        registrationNo,
        name,
        department,
        section,
        year,
        durationMinutes,
        systemCode: rawSystemNo,
        systemNumber: rawSystemNo,
        faculty,
      },
      clientIp
    );

    // Also record attendance entry for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (session.studentId) {
      try {
        await attendanceService.recordAttendance(session.studentId, today, 'PRESENT', session.id);
      } catch (_) {
        // Non-blocking
      }
    }

    return sendSuccess(
      res,
      {
        sessionId: session.localId || session.id,
        id: session.id,
        localId: session.localId,
        systemCode: session.system?.systemCode || rawSystemNo,
        studentName: session.nameSnapshot || name,
        registrationNo: session.registrationNoSnapshot || registrationNo,
        faculty: session.faculty,
        status: session.status,
        durationMinutes: session.durationMinutes,
      },
      'Session recorded successfully.',
      201
    );
  } catch (err) {
    next(err);
  }
}

/**
 * End attendance session from Student Client.
 * PUT/PATCH/POST /api/attendance/:id/end or POST /api/attendance/end
 */
async function endAttendanceSession(req, res, next) {
  try {
    const sessionId =
      req.params.sessionId || req.params.id || req.body.sessionId || req.body.id || req.body.localId;
    if (!sessionId) {
      throw createError('sessionId is required.', 400, 'VALIDATION_ERROR');
    }

    const session = await sessionService.endSession(sessionId);
    return sendSuccess(
      res,
      {
        sessionId: session.id,
        localId: session.localId,
        status: session.status,
        actualEndTime: session.actualEndTime,
      },
      'Session ended successfully.'
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAttendance,
  recordAttendance,
  endAttendanceSession,
};
