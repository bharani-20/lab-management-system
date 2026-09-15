'use strict';

/**
 * Socket.IO Event Reference
 * ==========================
 * Documents all events emitted by the server.
 * These are emitted from services, not from this file directly.
 *
 * Events emitted by the server:
 *
 * session:started
 *   Emitted when a new session is created.
 *   Payload: { sessionId, localId, systemCode, studentName, registrationNo, startTime, expectedEndTime }
 *
 * session:ended
 *   Emitted when a session is ended.
 *   Payload: { sessionId, systemCode, status, actualEndTime }
 *
 * system:status
 *   Emitted when a system's status changes.
 *   Payload: { systemCode, status }
 *
 * sync:completed
 *   Emitted when an offline sync batch completes.
 *   Payload: { synced, duplicates, failed }
 *
 * student:presence
 *   (Optional broadcast) Emitted to update all presence views.
 *   Payload: { activeSessions: [...] }
 *
 * dashboard:update
 *   (Optional broadcast) Emitted to trigger dashboard refresh.
 *   Payload: { stats }
 *
 * Events listened from clients:
 *
 * join:admin
 *   Client joins the 'admin' room for admin-specific broadcasts.
 *
 * join:lab
 *   Client joins the 'lab' room for lab-specific broadcasts.
 */

const SOCKET_EVENTS = {
  SESSION_STARTED: 'session:started',
  SESSION_ENDED: 'session:ended',
  SYSTEM_STATUS: 'system:status',
  SYNC_COMPLETED: 'sync:completed',
  STUDENT_PRESENCE: 'student:presence',
  DASHBOARD_UPDATE: 'dashboard:update',
};

module.exports = { SOCKET_EVENTS };
