'use strict';

const { sendError } = require('../utils/response');

/**
 * 404 handler middleware.
 * Must be registered AFTER all routes but BEFORE the error handler.
 */
function notFoundHandler(req, res) {
  return sendError(res, {
    status: 404,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
}

module.exports = { notFoundHandler };
