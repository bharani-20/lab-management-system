'use strict';

const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { getSocketIO } = require('../socket/socket');
const { SYSTEM_STATUS, SESSION_STATUS, SYNC_SOURCE } = require('../utils/constants');
const { serializeSession } = require('../utils/sessionSerializer');
const logger = require('../utils/logger');

/**
 * Calculate expected end time from start time + duration.
 * This is ALWAYS done on the backend — never trusted from frontend.
 *
 * @param {Date|string} startTime
 * @param {number} durationMinutes
 * @returns {Date}
 */
function calculateExpectedEndTime(startTime, durationMinutes) {
  const start = new Date(startTime);
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Find or create a student record by registrationNo.
 * Updates student details to latest values.
 *
 * @param {object} studentData
 * @param {object} tx - Prisma transaction client
 * @returns {Promise<object>}
 */
async function findOrCreateStudent(studentData, tx = prisma) {
  const { registrationNo, name, department, section, year } = studentData;

  return tx.student.upsert({
    where: { registrationNo },
    update: { name, department, section, year },
    create: { registrationNo, name, department, section, year },
  });
}

/**
 * Create a new lab session.
 *
 * Steps:
 * 1. Validate input (done via middleware)
 * 2. Find/create student
 * 3. Find system by systemCode
 * 4. Check system availability
 * 5. Check for active session conflict on this system
 * 6. Capture server-side trusted startTime (or use provided client start time if offline sync, stored in UTC)
 * 7. Calculate expectedEndTime server-side from durationMinutes
 * 8. Create session + mark system ACTIVE in a transaction
 * 9. Emit Socket.IO events
 */
async function createSession(data, clientIp = null) {
  const {
    localId,
    registrationNo: rawRegNo,
    name,
    department,
    section,
    year,
    durationMinutes,
    systemCode: rawSystemCode,
    systemNumber: rawSystemNumber,
    faculty,
  } = data;

  const registrationNo = rawRegNo ? rawRegNo.trim().toUpperCase() : '';
  const { normalizeSystemCode } = require('../utils/systemCodeHelper');
  const normalizedSystemCode = normalizeSystemCode(rawSystemCode || rawSystemNumber);

  // Check if localId already exists (idempotency for online & sync submissions)
  const existingSession = await prisma.session.findUnique({
    where: { localId },
    include: {
      student: { select: { id: true, registrationNo: true, name: true } },
      system: { select: { id: true, systemCode: true, hostname: true } },
    },
  });
  if (existingSession) {
    return existingSession;
  }

  // Find system
  let system = await prisma.system.findUnique({ where: { systemCode: normalizedSystemCode } });
  if (!system && rawSystemCode) {
    system = await prisma.system.findUnique({ where: { systemCode: rawSystemCode } });
  }
  if (!system) {
    throw createError(`System ${rawSystemCode || normalizedSystemCode} not found.`, 404, 'SYSTEM_NOT_FOUND');
  }
  const systemCode = system.systemCode;

  // Check system status
  if (system.status === SYSTEM_STATUS.MAINTENANCE) {
    throw createError(
      `System ${systemCode} is currently under maintenance.`,
      409,
      'SYSTEM_MAINTENANCE'
    );
  }
  if (system.status === SYSTEM_STATUS.OFFLINE) {
    throw createError(
      `System ${systemCode} is currently offline.`,
      409,
      'SYSTEM_OFFLINE'
    );
  }

  // Check for active session conflict on this system
  const activeSystemSession = await prisma.session.findFirst({
    where: { systemId: system.id, status: SESSION_STATUS.ACTIVE },
  });
  if (activeSystemSession) {
    // If the active session on this system belongs to the same student, return STUDENT_ALREADY_ACTIVE
    if (activeSystemSession.registrationNoSnapshot?.toUpperCase() === registrationNo) {
      throw createError('Invalid User', 409, 'STUDENT_ALREADY_ACTIVE', {
        registrationNo,
        message: 'This registration number is already active on another system.',
      });
    }
    throw createError(
      `System ${systemCode} already has an active session.`,
      409,
      'SYSTEM_BUSY'
    );
  }

  // Check if this student already has an active session on any system in the lab
  const activeStudentSession = await prisma.session.findFirst({
    where: {
      registrationNoSnapshot: { equals: registrationNo, mode: 'insensitive' },
      status: SESSION_STATUS.ACTIVE,
    },
    include: {
      system: { select: { systemCode: true } },
    },
  });
  if (activeStudentSession) {
    throw createError('Invalid User', 409, 'STUDENT_ALREADY_ACTIVE', {
      registrationNo,
      activeSystemCode: activeStudentSession.system?.systemCode,
      message: 'This registration number is already active on another system.',
    });
  }

  // ONLINE SESSION: startTime is ALWAYS the backend server clock.
  // The client cannot supply or override this value.
  // (Offline sessions use client-captured startTime through syncService.js, not here.)
  const startTime = new Date();

  // Backend MUST calculate expectedEndTime from durationMinutes
  const expectedEndTime = calculateExpectedEndTime(startTime, durationMinutes);

  // Run creation in a transaction for atomicity and race-condition safety
  const session = await prisma.$transaction(async (tx) => {
    // Concurrency check: ensure student did not concurrently start a session
    const concurrentActiveSession = await tx.session.findFirst({
      where: {
        registrationNoSnapshot: { equals: registrationNo, mode: 'insensitive' },
        status: SESSION_STATUS.ACTIVE,
      },
    });
    if (concurrentActiveSession) {
      throw createError('Invalid User', 409, 'STUDENT_ALREADY_ACTIVE', {
        registrationNo,
        message: 'This registration number is already active on another system.',
      });
    }

    const student = await findOrCreateStudent({ registrationNo, name, department, section, year }, tx);

    const newSession = await tx.session.create({
      data: {
        localId,
        studentId: student.id,
        registrationNoSnapshot: registrationNo,
        nameSnapshot: name,
        departmentSnapshot: department,
        sectionSnapshot: section,
        yearSnapshot: year,
        faculty: faculty || null,
        systemId: system.id,
        durationMinutes,
        startTime: startTime,
        expectedEndTime,
        lastHeartbeatAt: new Date(),
        status: SESSION_STATUS.ACTIVE,
        syncSource: SYNC_SOURCE.ONLINE,
      },
      include: {
        student: { select: { id: true, registrationNo: true, name: true } },
        system: { select: { id: true, systemCode: true, hostname: true } },
      },
    });

    // Mark system as ACTIVE and update IP if detected
    const systemUpdateData = {
      status: SYSTEM_STATUS.ACTIVE,
      lastSeenAt: new Date(),
    };
    if (clientIp) {
      systemUpdateData.ipAddress = clientIp;
    }

    await tx.system.update({
      where: { id: system.id },
      data: systemUpdateData,
    });

    return newSession;
  });

  // Emit Socket.IO events
  try {
    const io = getSocketIO();
    if (io) {
      io.emit('session:started', {
        sessionId: session.id,
        localId: session.localId,
        systemCode,
        studentName: name,
        registrationNo,
        startTime: session.startTime,
        expectedEndTime: session.expectedEndTime,
      });
      io.emit('system:status', { systemCode, status: SYSTEM_STATUS.ACTIVE });
    }
  } catch {
    // Non-fatal
  }

  return session;
}

/**
 * End an active session.
 * Automatically captures current server date/time as actualEndTime.
 */
async function endSession(id) {
  let session = await prisma.session.findUnique({
    where: { id },
    include: { system: true },
  });

  if (!session) {
    session = await prisma.session.findUnique({
      where: { localId: id },
      include: { system: true },
    });
  }

  if (!session) {
    throw createError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  if (session.status !== SESSION_STATUS.ACTIVE) {
    throw createError(
      `Session is not active. Current status: ${session.status}`,
      409,
      'SESSION_NOT_ACTIVE'
    );
  }

  // Automatic capture of server timestamp
  const actualEndTime = new Date();

  const updatedSession = await prisma.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id: session.id },
      data: {
        status: SESSION_STATUS.COMPLETED,
        actualEndTime,
      },
      include: {
        student: { select: { id: true, registrationNo: true, name: true } },
        system: { select: { id: true, systemCode: true, hostname: true } },
      },
    });

    // Mark system AVAILABLE
    await tx.system.update({
      where: { id: session.systemId },
      data: { status: SYSTEM_STATUS.AVAILABLE, lastSeenAt: new Date() },
    });

    return updated;
  });

  // Emit Socket.IO events
  try {
    const io = getSocketIO();
    if (io) {
      io.emit('session:ended', {
        sessionId: id,
        systemCode: session.system.systemCode,
        status: SESSION_STATUS.COMPLETED,
        actualEndTime,
      });
      io.emit('system:status', {
        systemCode: session.system.systemCode,
        status: SYSTEM_STATUS.AVAILABLE,
      });
    }
  } catch {
    // Non-fatal
  }

  return updatedSession;
}

/**
 * Record a heartbeat from a student client system.
 * Updates lastHeartbeatAt on active session, lastSeenAt, and dynamic ipAddress on system.
 */
async function recordHeartbeat(systemCode, localId, ipAddress = null) {
  const now = new Date();

  const system = await prisma.system.findUnique({ where: { systemCode } });
  if (!system) {
    throw createError(`System ${systemCode} not found.`, 404, 'SYSTEM_NOT_FOUND');
  }

  logger.info('[SYSTEM_HEARTBEAT] Session heartbeat ping received', {
    systemCode,
    localId,
    ipAddress,
  });

  const systemUpdateData = {
    lastSeenAt: now,
    status: SYSTEM_STATUS.ACTIVE,
  };

  if (ipAddress) {
    // Check if IP address changed
    if (system.ipAddress !== ipAddress) {
      logger.info('[SYSTEM_IP_UPDATED] System IP address updated via session heartbeat', {
        systemCode,
        oldIp: system.ipAddress,
        newIp: ipAddress,
      });
    }

    // Reconcile duplicate/reassigned DHCP IP
    const conflicting = await prisma.system.findFirst({
      where: { ipAddress, systemCode: { not: systemCode } },
    });
    if (conflicting) {
      logger.warn('[SYSTEM_IP_CONFLICT] IP collision detected in session heartbeat', {
        conflictingSystemCode: conflicting.systemCode,
        currentSystemCode: systemCode,
        ipAddress,
      });
      await prisma.system.update({
        where: { id: conflicting.id },
        data: { ipAddress: null },
      });
    }
    systemUpdateData.ipAddress = ipAddress;
  }

  const updatedSystem = await prisma.system.update({
    where: { id: system.id },
    data: systemUpdateData,
  });

  let session = null;
  if (localId) {
    session = await prisma.session.findUnique({ where: { localId } });
  } else {
    session = await prisma.session.findFirst({
      where: { systemId: system.id, status: SESSION_STATUS.ACTIVE },
    });
  }

  if (session && session.status === SESSION_STATUS.ACTIVE) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastHeartbeatAt: now },
    });
  }

  return { success: true, timestamp: now, systemCode, ipAddress: updatedSystem.ipAddress };
}

/**
 * Reconcile stale sessions (Sudden Power-Off / Hard Shutdown Handling).
 * Checks active sessions where expectedEndTime < now OR no heartbeat received for > 5 minutes.
 * Sets status to EXPIRED or COMPLETED, setting actualEndTime to last known heartbeat (or expectedEndTime).
 * Never falsely claims an exact shutdown timestamp was captured when it was not.
 */
async function reconcileStaleSessions() {
  const now = new Date();
  const heartbeatThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

  // Find sessions active past expectedEndTime or missing heartbeat
  const staleSessions = await prisma.session.findMany({
    where: {
      status: SESSION_STATUS.ACTIVE,
      OR: [
        { expectedEndTime: { lte: now } },
        { lastHeartbeatAt: { lte: heartbeatThreshold } },
      ],
    },
    include: { system: true },
  });

  const reconciled = [];

  for (const session of staleSessions) {
    const isExpired = session.expectedEndTime <= now;
    const finalStatus = isExpired ? SESSION_STATUS.EXPIRED : SESSION_STATUS.COMPLETED;
    // Set actualEndTime to last heartbeat if available, else expectedEndTime
    const calculatedEndTime = session.lastHeartbeatAt || session.expectedEndTime;

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.session.update({
        where: { id: session.id },
        data: {
          status: finalStatus,
          actualEndTime: calculatedEndTime,
        },
      });

      // Release system back to AVAILABLE
      await tx.system.update({
        where: { id: session.systemId },
        data: { status: SYSTEM_STATUS.AVAILABLE },
      });

      return s;
    });

    reconciled.push(updated);
  }

  return { reconciledCount: reconciled.length };
}

/**
 * List sessions with filters, pagination, and role-based timing serialization.
 */
async function listSessions(query = {}, userRole = 'ADMIN') {
  const { page, limit, skip } = parsePagination(query);
  const { status, systemCode, registrationNo, from, to } = query;

  const where = {};
  if (status) where.status = status;
  if (registrationNo) where.registrationNoSnapshot = { contains: registrationNo, mode: 'insensitive' };
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
        student: { select: { id: true, registrationNo: true, name: true, department: true, section: true, year: true } },
        system: { select: { id: true, systemCode: true, hostname: true } },
      },
    }),
    prisma.session.count({ where }),
  ]);

  const sanitizedSessions = serializeSession(sessions, userRole);

  return { sessions: sanitizedSessions, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Get a single session by ID with role-based timing serialization.
 */
async function getSessionById(id, userRole = 'ADMIN') {
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      student: true,
      system: true,
    },
  });
  if (!session) throw createError('Session not found.', 404, 'SESSION_NOT_FOUND');

  return serializeSession(session, userRole);
}

module.exports = {
  createSession,
  endSession,
  recordHeartbeat,
  reconcileStaleSessions,
  listSessions,
  getSessionById,
  calculateExpectedEndTime,
  findOrCreateStudent,
};
