'use strict';

require('dotenv').config();

const http = require('http');
const config = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const logger = require('./utils/logger');
const app = require('./app');

// Socket.IO and cron jobs (imported after app is initialized)
const { initializeSocket } = require('./socket/socket');
const { startCleanupJob } = require('./jobs/dataCleanupJob');

const server = http.createServer(app);

// Attach Socket.IO
initializeSocket(server);

// ─── Startup ───────────────────────────────────────────────────────────────────

async function start() {
  try {
    // 1. Connect to PostgreSQL via Prisma
    logger.info('Connecting to PostgreSQL database...');
    await connectDatabase();
    logger.info('PostgreSQL connected successfully.');

    // 2. Start cron jobs
    startCleanupJob();
    logger.info('Scheduled jobs started.');

    // 3. Start HTTP server — bind to 0.0.0.0 for LAN access
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server listening on 0.0.0.0:${config.port}`, {
        env: config.nodeEnv,
        port: config.port,
        pid: process.pid,
      });
      logger.info(`Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (err) {
    logger.error('Failed to start server', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await disconnectDatabase();
    logger.info('Server closed. Goodbye.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

start();
