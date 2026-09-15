'use strict';

const { prisma } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/health
 * Public endpoint. Returns server + database health status.
 */
async function healthCheck(req, res, next) {
  try {
    // Test DB connection with a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(res, {
      status: 200,
      message: 'Lab Management Backend is healthy',
      data: {
        server: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      },
    });
  } catch (err) {
    return sendError(res, {
      status: 503,
      message: 'Database connection failed',
      code: 'DATABASE_UNAVAILABLE',
      details: { database: 'error', server: 'ok' },
    });
  }
}

module.exports = { healthCheck };
