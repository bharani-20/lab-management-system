'use strict';

const { prisma } = require('../config/database');
const { calculateExpectedEndTime, findOrCreateStudent } = require('./sessionService');
const { getSocketIO } = require('../socket/socket');
const { SYNC_SOURCE, SESSION_STATUS, SYSTEM_STATUS } = require('../utils/constants');

/**
 * Sync a batch of offline sessions.
 *
 * Rules:
 * - localId is the idempotency key — duplicate localIds are not re-created
 * - Each item is processed individually so partial failures don't abort the batch
 * - syncSource is set to OFFLINE_SYNC
 *
 * @param {Array} sessions - Array of session objects from offline storage
 * @returns {Promise<{synced: number, duplicates: number, failed: number, results: Array}>}
 */
async function syncSessions(sessions) {
  let synced = 0;
  let duplicates = 0;
  let failed = 0;
  const results = [];

  for (const item of sessions) {
    const {
      localId,
      registrationNo,
      name,
      department,
      section,
      year,
      durationMinutes,
      systemCode,
      startTime,
      actualEndTime,
      status,
    } = item;

    try {
      // Check for duplicate localId first (idempotency)
      const existing = await prisma.session.findUnique({ where: { localId } });
      if (existing) {
        duplicates++;
        results.push({
          localId,
          result: 'duplicate',
          message: 'Session with this localId already exists',
          sessionId: existing.id,
        });
        continue;
      }

      // Find system
      const system = await prisma.system.findUnique({ where: { systemCode } });
      if (!system) {
        failed++;
        results.push({ localId, result: 'failed', message: `System ${systemCode} not found` });
        continue;
      }

      // Calculate server-side expectedEndTime
      const expectedEndTime = calculateExpectedEndTime(startTime, durationMinutes);

      // Determine final status
      let finalStatus = status || SESSION_STATUS.COMPLETED;

      // Duplicate active student restriction for offline-synced ACTIVE sessions
      if (finalStatus === SESSION_STATUS.ACTIVE) {
        const normalizedRegNo = registrationNo ? registrationNo.trim().toUpperCase() : '';
        const activeElsewhere = await prisma.session.findFirst({
          where: {
            registrationNoSnapshot: { equals: normalizedRegNo, mode: 'insensitive' },
            status: SESSION_STATUS.ACTIVE,
          },
          include: { system: { select: { systemCode: true } } },
        });
        if (activeElsewhere) {
          // Downgrade to CONFLICT so we don't create a second active session
          finalStatus = 'CONFLICT';
        }
      }

      await prisma.$transaction(async (tx) => {
        // Find or create student
        const student = await findOrCreateStudent({ registrationNo, name, department, section, year }, tx);

        // Create session
        await tx.session.create({
          data: {
            localId,
            studentId: student.id,
            registrationNoSnapshot: registrationNo,
            nameSnapshot: name,
            departmentSnapshot: department,
            sectionSnapshot: section,
            yearSnapshot: year,
            systemId: system.id,
            durationMinutes,
            startTime: new Date(startTime),
            expectedEndTime,
            actualEndTime: actualEndTime ? new Date(actualEndTime) : new Date(),
            status: finalStatus,
            syncSource: SYNC_SOURCE.OFFLINE_SYNC,
          },
        });

        // If this synced session was active and system is now free, we could update status
        // but since offline sessions typically come in as COMPLETED, we only update if ACTIVE
        if (finalStatus === SESSION_STATUS.ACTIVE) {
          const currentSystem = await tx.system.findUnique({ where: { id: system.id } });
          if (currentSystem && currentSystem.status === SYSTEM_STATUS.AVAILABLE) {
            await tx.system.update({
              where: { id: system.id },
              data: { status: SYSTEM_STATUS.ACTIVE, lastSeenAt: new Date() },
            });
          }
        }
      });

      synced++;
      results.push({
        localId,
        result: finalStatus === 'CONFLICT' ? 'conflict' : 'synced',
        message:
          finalStatus === 'CONFLICT'
            ? 'Session stored as CONFLICT: student already has an active session on another system'
            : 'Session synced successfully',
      });
    } catch (err) {
      failed++;
      results.push({
        localId,
        result: 'failed',
        message: err.message || 'Unknown error during sync',
      });
    }
  }

  // Emit sync:completed event
  try {
    const io = getSocketIO();
    if (io) {
      io.emit('sync:completed', { synced, duplicates, failed });
    }
  } catch {
    // Non-fatal
  }

  return { synced, duplicates, failed, results };
}

module.exports = { syncSessions, syncSessionsBatch: syncSessions };
