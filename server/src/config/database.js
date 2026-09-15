'use strict';

const { PrismaClient } = require('@prisma/client');
const config = require('./env');

/**
 * Singleton Prisma client instance.
 * Logs queries in development; only errors in production.
 */
const prisma = new PrismaClient({
  log:
    config.isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
  errorFormat: 'colorless',
});

/**
 * Test database connectivity.
 * @returns {Promise<boolean>}
 */
async function connectDatabase() {
  try {
    await prisma.$connect();
    return true;
  } catch (err) {
    throw new Error(`[database] Failed to connect to PostgreSQL: ${err.message}`);
  }
}

/**
 * Gracefully disconnect Prisma on process exit.
 */
async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
