'use strict';

const cron = require('node-cron');
const { prisma } = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * 21-Day Data Cleanup Job
 * =======================
 * Runs automatically once per day (default 02:00 AM UTC/local).
 * Deletes completed/expired Session and Attendance records older than CLEANUP_DAYS.
 *
 * Strict Preservation Policy:
 * - Users (preserved)
 * - Systems PC-01 to PC-64 (preserved)
 * - Students master records (preserved)
 * - Timetable configurations (preserved)
 * - Active sessions (preserved)
 * - Records newer than cleanup cutoff (preserved)
 *
 * Deletes in foreign key dependency order:
 * 1. Attendances (child records referencing sessions)
 * 2. Sessions (historical records referencing students/systems)
 */
async function runCleanup() {
  const cleanupDays = config.cleanup.days || 21;
  const now = new Date();
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - cleanupDays,
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ));

  logger.info(`[CLEANUP_STARTED] Starting automatic data cleanup for records older than ${cleanupDays} days`, {
    cleanupDays,
    cutoffDate: cutoff.toISOString(),
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete historical attendance records older than cutoff
      const deletedAttendance = await tx.attendance.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });

      // 2. Delete non-active historical sessions older than cutoff
      const deletedSessions = await tx.session.deleteMany({
        where: {
          startTime: { lt: cutoff },
          status: { not: 'ACTIVE' },
        },
      });

      return {
        deletedAttendance: deletedAttendance.count,
        deletedSessions: deletedSessions.count,
      };
    });

    logger.info('[CLEANUP_COMPLETED] Automatic data cleanup completed successfully', {
      deletedAttendance: result.deletedAttendance,
      deletedSessions: result.deletedSessions,
      cutoffDate: cutoff.toISOString(),
    });

    return result;
  } catch (err) {
    logger.error('[CLEANUP_ERROR] Automatic data cleanup job failed', {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }
}

/**
 * Start the scheduled cleanup cron job.
 * Runs daily at 02:00 AM.
 */
function startCleanupJob() {
  // '0 2 * * *' = every day at 02:00 AM
  const job = cron.schedule('0 2 * * *', async () => {
    try {
      await runCleanup();
    } catch (err) {
      logger.error('[CLEANUP_ERROR] Scheduled cleanup failed', { message: err.message });
    }
  });

  logger.info('[cleanup] Cleanup job scheduled (daily at 02:00 AM)');
  return job;
}

module.exports = { startCleanupJob, runCleanup };
