'use strict';

const { USER_ROLE } = require('./constants');

/**
 * Sanitize session object according to user role.
 *
 * Rules:
 * 6. STUDENT TIMING VISIBILITY: Student Client must NOT receive/display:
 *    - Start Time
 *    - Expected End Time
 *    - Actual End Time
 *    Student only sees: duration, remaining countdown, session status.
 *
 * 7. ADMIN TIMING VISIBILITY: ADMIN can view:
 *    - Start Time, Expected End Time, Actual End Time, Duration, Status, System, Student
 *
 * 8. FACULTY AND NON-TEACHING STAFF TIMING RESTRICTION:
 *    FACULTY and NON_TEACHING_STAFF must NOT receive or view:
 *    - Start Time
 *    - Expected End Time
 *    - Actual End Time
 *    - Internal timing information (lastHeartbeatAt)
 *    Enforced at the BACKEND response-serialization level.
 *
 * @param {object|Array} sessionData
 * @param {string} [userRole]
 * @returns {object|Array}
 */
function serializeSession(sessionData, userRole) {
  if (!sessionData) return sessionData;

  // Only ADMIN has authorization to view Start Time, Expected End Time, and Actual End Time
  if (userRole === USER_ROLE.ADMIN) {
    return sessionData;
  }

  if (Array.isArray(sessionData)) {
    return sessionData.map((s) => serializeSession(s, userRole));
  }

  const sanitized = { ...sessionData };
  delete sanitized.startTime;
  delete sanitized.expectedEndTime;
  delete sanitized.actualEndTime;
  delete sanitized.lastHeartbeatAt;

  // Handle nested student/system session references if present
  if (sanitized.activeSession) {
    sanitized.activeSession = serializeSession(sanitized.activeSession, userRole);
  }
  if (sanitized.sessions && Array.isArray(sanitized.sessions)) {
    sanitized.sessions = sanitized.sessions.map((s) => serializeSession(s, userRole));
  }

  return sanitized;
}

module.exports = { serializeSession };
