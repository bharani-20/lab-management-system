'use strict';

require('dotenv').config();

/**
 * Validates and exports all environment configuration.
 * Throws at startup if required variables are missing.
 */

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`[config/env] Missing required environment variable: ${key}`);
  }
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.JWT_SECRET === 'CHANGE_ME_IN_PRODUCTION_USE_A_LONG_RANDOM_STRING'
) {
  throw new Error('[config/env] JWT_SECRET must be changed from the default value in production!');
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  cors: {
    // Split comma-separated origins into array; trim whitespace
    origins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  cleanup: {
    days: parseInt(process.env.CLEANUP_DAYS, 10) || 21,
  },

  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
};

module.exports = config;
