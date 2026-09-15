'use strict';

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Global error handler middleware.
 * Must be the last middleware registered in app.js.
 *
 * Handles:
 * - Prisma known errors (P2002 unique, P2025 not found, etc.)
 * - Zod validation errors
 * - JWT errors
 * - Generic errors
 *
 * Never exposes stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Log full error
  logger.error('Unhandled error', {
    message: err.message,
    code: err.code,
    stack: config.isDevelopment ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  // ── Prisma errors ───────────────────────────────────────────────────────────

  if (err.code === 'P2002') {
    // Unique constraint violation
    const fields = err.meta?.target || ['unknown'];
    return sendError(res, {
      status: 409,
      message: `Duplicate value: ${fields.join(', ')} already exists.`,
      code: 'DUPLICATE_ENTRY',
      details: { fields },
    });
  }

  if (err.code === 'P2025') {
    // Record not found
    return sendError(res, {
      status: 404,
      message: err.meta?.cause || 'Record not found.',
      code: 'NOT_FOUND',
    });
  }

  if (err.code === 'P2003') {
    // Foreign key constraint
    return sendError(res, {
      status: 400,
      message: 'Referenced record does not exist.',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }

  // ── JWT errors ──────────────────────────────────────────────────────────────

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, {
      status: 401,
      message: 'Invalid token.',
      code: 'INVALID_TOKEN',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, {
      status: 401,
      message: 'Token has expired.',
      code: 'TOKEN_EXPIRED',
    });
  }

  // ── Known application errors ─────────────────────────────────────────────

  if (err.statusCode) {
    return sendError(res, {
      status: err.statusCode,
      message: err.message,
      code: err.errorCode || 'APPLICATION_ERROR',
      details: err.details,
    });
  }

  // ── Fallback ─────────────────────────────────────────────────────────────

  return sendError(res, {
    status: 500,
    message: config.isDevelopment
      ? err.message
      : 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_SERVER_ERROR',
    details: config.isDevelopment ? { stack: err.stack } : undefined,
  });
}

/**
 * Creates an application error with a specific HTTP status code.
 * Use this in services to throw structured errors.
 */
function createError(message, statusCode = 500, errorCode = 'APPLICATION_ERROR', details = undefined) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  if (details !== undefined) err.details = details;
  return err;
}

module.exports = { errorHandler, createError };
