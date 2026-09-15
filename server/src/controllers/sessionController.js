'use strict';

const sessionService = require('../services/sessionService');
const { sendSuccess } = require('../utils/response');
const { serializeSession } = require('../utils/sessionSerializer');
const { extractClientIp } = require('../utils/ipHelper');

/**
 * POST /api/sessions
 * Start a new lab session.
 * Student Client receives duration and session details, but NOT Start Time / End Time.
 */
async function createSession(req, res, next) {
  try {
    const clientIp = extractClientIp(req, req.body?.ipAddress);
    const session = await sessionService.createSession(req.body, clientIp);
    const userRole = req.user ? req.user.role : 'STUDENT';
    const sanitized = serializeSession(session, userRole);
    return sendSuccess(res, sanitized, 'Session started successfully.', 201);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/sessions/:id/end
 * End an active lab session.
 * Student Client receives completion status, but NOT exact timing fields.
 */
async function endSession(req, res, next) {
  try {
    const session = await sessionService.endSession(req.params.id);
    const userRole = req.user ? req.user.role : 'STUDENT';
    const sanitized = serializeSession(session, userRole);
    return sendSuccess(res, sanitized, 'Session ended successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sessions/heartbeat
 * Record heartbeat from student client system with dynamic IP discovery.
 */
async function recordHeartbeat(req, res, next) {
  try {
    const { systemCode, localId, ipAddress } = req.body;
    const clientIp = extractClientIp(req, ipAddress);
    const result = await sessionService.recordHeartbeat(systemCode, localId, clientIp);
    return sendSuccess(res, result, 'Heartbeat recorded.');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sessions/reconcile
 * Trigger reconciliation of stale sessions (sudden power off / hard shutdown).
 * Admin or system trigger.
 */
async function reconcileStaleSessions(req, res, next) {
  try {
    const result = await sessionService.reconcileStaleSessions();
    return sendSuccess(res, result, 'Stale sessions reconciled.');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sessions
 * List sessions with filtering, pagination, and role-based timing serialization.
 */
async function listSessions(req, res, next) {
  try {
    const userRole = req.user ? req.user.role : 'ADMIN';
    const result = await sessionService.listSessions(req.query, userRole);
    return sendSuccess(res, result.sessions, 'Sessions retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sessions/:id
 * Get single session by ID with role-based timing serialization.
 */
async function getSessionById(req, res, next) {
  try {
    const userRole = req.user ? req.user.role : 'ADMIN';
    const session = await sessionService.getSessionById(req.params.id, userRole);
    return sendSuccess(res, session, 'Session retrieved.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSession,
  endSession,
  recordHeartbeat,
  reconcileStaleSessions,
  listSessions,
  getSessionById,
};
