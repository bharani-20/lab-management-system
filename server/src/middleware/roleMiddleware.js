'use strict';

const { sendError } = require('../utils/response');

/**
 * Role-based access control middleware.
 * Must be used AFTER authenticate middleware.
 *
 * Usage: router.get('/route', authenticate, requireRole('ADMIN'), handler)
 *
 * @param {...string} roles - Allowed role names
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        status: 401,
        message: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, {
        status: 403,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

module.exports = { requireRole };
