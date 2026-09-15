'use strict';

const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const { prisma } = require('../config/database');

/**
 * Authentication middleware.
 * Extracts Bearer token → verifies JWT → attaches req.user.
 * Returns 401 if token is missing, malformed, expired, or user is inactive.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, {
        status: 401,
        message: 'Authentication required. Provide a Bearer token.',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return sendError(res, {
        status: 401,
        message: isExpired ? 'Token has expired. Please log in again.' : 'Invalid token.',
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    });

    if (!user) {
      return sendError(res, {
        status: 401,
        message: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return sendError(res, {
        status: 401,
        message: 'User account is deactivated. Contact administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication middleware.
 * Attaches req.user if token present and valid, but does not block on missing token.
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.slice(7);
    try {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, name: true, role: true, isActive: true },
      });
      if (user && user.isActive) req.user = user;
    } catch {
      // Ignore
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorization middleware by role.
 * Enforces HTTP 403 Forbidden for unauthorized roles.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        status: 401,
        message: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, {
        status: 403,
        message: `Forbidden: Access restricted for role ${req.user.role}.`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

module.exports = { authenticate, optionalAuthenticate, authorize };
