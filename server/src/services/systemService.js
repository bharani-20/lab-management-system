'use strict';

const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const { SYSTEM_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * List all systems with optional status filter.
 */
async function listSystems(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { status, search } = query;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { systemCode: { contains: search, mode: 'insensitive' } },
      { hostname: { contains: search, mode: 'insensitive' } },
      { ipAddress: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [systems, total] = await Promise.all([
    prisma.system.findMany({
      where,
      skip,
      take: limit,
      orderBy: { systemCode: 'asc' },
    }),
    prisma.system.count({ where }),
  ]);

  return { systems, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Get a single system by ID or systemCode.
 */
async function getSystemById(id) {
  let system = await prisma.system.findUnique({
    where: { id },
    include: {
      sessions: {
        where: { status: 'ACTIVE' },
        include: {
          student: { select: { name: true, registrationNo: true } },
        },
        take: 1,
      },
    },
  });

  if (!system) {
    system = await prisma.system.findUnique({
      where: { systemCode: id },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            student: { select: { name: true, registrationNo: true } },
          },
          take: 1,
        },
      },
    });
  }

  if (!system) throw createError('System not found.', 404, 'SYSTEM_NOT_FOUND');
  return system;
}

/**
 * Create a new system.
 */
async function createSystem(data) {
  const existing = await prisma.system.findUnique({ where: { systemCode: data.systemCode } });
  if (existing) {
    throw createError(`System with code ${data.systemCode} already exists.`, 409, 'DUPLICATE_SYSTEM_CODE');
  }
  return prisma.system.create({ data: { ...data, status: data.status || SYSTEM_STATUS.AVAILABLE } });
}

/**
 * Update a system.
 * Validates that status changes are consistent with active sessions.
 */
async function updateSystem(id, data) {
  const system = await prisma.system.findUnique({ where: { id } });
  if (!system) throw createError('System not found.', 404, 'SYSTEM_NOT_FOUND');

  // If setting to MAINTENANCE or OFFLINE, ensure no ACTIVE sessions
  if (data.status && ['MAINTENANCE', 'OFFLINE'].includes(data.status)) {
    const activeSession = await prisma.session.findFirst({
      where: { systemId: id, status: 'ACTIVE' },
    });
    if (activeSession) {
      throw createError(
        `Cannot set system to ${data.status} while an active session exists. End the session first.`,
        409,
        'SYSTEM_HAS_ACTIVE_SESSION'
      );
    }
  }

  return prisma.system.update({ where: { id }, data });
}

/**
 * Delete a system.
 * Cannot delete a system with active sessions.
 */
async function deleteSystem(id) {
  const system = await prisma.system.findUnique({ where: { id } });
  if (!system) throw createError('System not found.', 404, 'SYSTEM_NOT_FOUND');

  const activeSession = await prisma.session.findFirst({
    where: { systemId: id, status: 'ACTIVE' },
  });
  if (activeSession) {
    throw createError('Cannot delete a system with an active session.', 409, 'SYSTEM_HAS_ACTIVE_SESSION');
  }

  return prisma.system.delete({ where: { id } });
}

/**
 * Automatically update a system's IP address and heartbeat.
 * Supports dynamic DHCP changes without manual admin intervention.
 * Detects and reconciles duplicate IP usage across systems.
 *
 * @param {string} systemCode - e.g. PC-01 ... PC-64
 * @param {string|null} ipAddress - dynamically discovered IPv4 address
 * @param {string} [hostname]
 * @returns {Promise<object>}
 */
async function recordSystemHeartbeat(systemCode, ipAddress = null, hostname = null) {
  const now = new Date();

  const system = await prisma.system.findUnique({ where: { systemCode } });
  if (!system) {
    throw createError(`System ${systemCode} not found.`, 404, 'SYSTEM_NOT_FOUND');
  }

  logger.info('[SYSTEM_HEARTBEAT] Received heartbeat ping', {
    systemCode,
    ipAddress,
    hostname,
  });

  const updateData = {
    lastSeenAt: now,
  };

  if (hostname) {
    updateData.hostname = hostname;
  }

  // If system was offline, bring back to AVAILABLE
  if (system.status === SYSTEM_STATUS.OFFLINE) {
    updateData.status = SYSTEM_STATUS.AVAILABLE;
    logger.info('[SYSTEM_ONLINE] System transitioned from OFFLINE to AVAILABLE', {
      systemCode,
      ipAddress: ipAddress || system.ipAddress,
    });
  }

  if (ipAddress) {
    // Check if IP address changed (DHCP change)
    if (system.ipAddress !== ipAddress) {
      logger.info('[SYSTEM_IP_UPDATED] Dynamic IP address updated for system', {
        systemCode,
        oldIp: system.ipAddress,
        newIp: ipAddress,
      });
    }

    // Detect duplicate IP conflict across systems
    const conflictingSystem = await prisma.system.findFirst({
      where: {
        ipAddress,
        systemCode: { not: systemCode },
      },
    });

    if (conflictingSystem) {
      logger.warn('[SYSTEM_IP_CONFLICT] IP conflict detected: same IP used by another system', {
        conflictingSystemCode: conflictingSystem.systemCode,
        currentSystemCode: systemCode,
        ipAddress,
      });

      // Clear the IP on the previous owner to prevent stale collision while preserving both system records
      await prisma.system.update({
        where: { id: conflictingSystem.id },
        data: { ipAddress: null },
      });
    }

    updateData.ipAddress = ipAddress;
  }

  const updatedSystem = await prisma.system.update({
    where: { id: system.id },
    data: updateData,
  });

  return {
    ...updatedSystem,
    currentIp: updatedSystem.ipAddress,
    online: updatedSystem.status !== SYSTEM_STATUS.OFFLINE,
    lastSeen: updatedSystem.lastSeenAt,
  };
}

/**
 * Update the status of a system by ID.
 * Used internally by sessionService to mark systems BUSY / AVAILABLE.
 *
 * @param {string} id - system DB id
 * @param {string} status - SYSTEM_STATUS value
 * @returns {Promise<object>}
 */
async function updateSystemStatus(id, status) {
  const system = await prisma.system.findUnique({ where: { id } });
  if (!system) throw createError('System not found.', 404, 'SYSTEM_NOT_FOUND');
  return prisma.system.update({ where: { id }, data: { status } });
}

/**
 * Get system information for student kiosk polling.
 * Supports query by systemCode, systemNumber, id, or client IP address.
 *
 * @param {object} query
 * @param {string|null} clientIp
 * @returns {Promise<object>}
 */
async function getSystemInfo(query = {}, clientIp = null) {
  const { systemCode, systemNumber, id } = query;
  const targetCode = systemCode || systemNumber || id;

  let system = null;
  if (targetCode) {
    const { normalizeSystemCode } = require('../utils/systemCodeHelper');
    const normalized = normalizeSystemCode(targetCode);
    system = await prisma.system.findFirst({
      where: {
        OR: [
          { systemCode: normalized },
          { systemCode: targetCode },
          { id: targetCode },
        ],
      },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            student: { select: { name: true, registrationNo: true } },
          },
          take: 1,
        },
      },
    });
  } else if (clientIp) {
    system = await prisma.system.findFirst({
      where: { ipAddress: clientIp },
      include: {
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            student: { select: { name: true, registrationNo: true } },
          },
          take: 1,
        },
      },
    });
  }

  if (!system) {
    if (targetCode) {
      throw createError(`System ${targetCode} not found.`, 404, 'SYSTEM_NOT_FOUND');
    }
    return {
      systemCode: null,
      ipAddress: clientIp,
      status: SYSTEM_STATUS.AVAILABLE,
      serverTime: new Date().toISOString(),
    };
  }

  return {
    id: system.id,
    systemCode: system.systemCode,
    systemNumber: system.systemCode,
    hostname: system.hostname || `DESKTOP-${system.systemCode}`,
    ipAddress: system.ipAddress,
    lab: 'Programming Lab',
    status: system.status,
    lastSeenAt: system.lastSeenAt,
    activeSession: system.sessions && system.sessions.length > 0 ? system.sessions[0] : null,
    serverTime: new Date().toISOString(),
  };
}

module.exports = {
  listSystems,
  getSystemById,
  getSystemInfo,
  createSystem,
  updateSystem,
  deleteSystem,
  updateSystemStatus,
  recordSystemHeartbeat,
};

