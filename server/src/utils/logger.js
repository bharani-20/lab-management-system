'use strict';

const morgan = require('morgan');
const config = require('../config/env');

/**
 * Simple structured logger.
 */
const logger = {
  info: (msg, meta = {}) => {
    const entry = { level: 'info', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.log(JSON.stringify(entry));
  },
  warn: (msg, meta = {}) => {
    const entry = { level: 'warn', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.warn(JSON.stringify(entry));
  },
  error: (msg, meta = {}) => {
    const entry = { level: 'error', timestamp: new Date().toISOString(), message: msg, ...meta };
    console.error(JSON.stringify(entry));
  },
  debug: (msg, meta = {}) => {
    if (config.isDevelopment) {
      const entry = { level: 'debug', timestamp: new Date().toISOString(), message: msg, ...meta };
      console.debug(JSON.stringify(entry));
    }
  },
};

/**
 * Morgan HTTP request logger stream that feeds into structured logger.
 */
logger.morganStream = {
  write: (message) => {
    logger.info(message.trim(), { source: 'http' });
  },
};

/**
 * Morgan middleware: combined format in production, dev format in development.
 */
logger.morganMiddleware = morgan(
  config.isDevelopment ? 'dev' : 'combined',
  { stream: config.isDevelopment ? undefined : logger.morganStream }
);

module.exports = logger;
