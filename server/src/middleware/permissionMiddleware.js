'use strict';

const { sendError } = require('../utils/response');
const { ROLE_PERMISSIONS } = require('../utils/constants');

/**
 * Permission-based access control middleware.
 * Must be used AFTER authenticate middleware.
 *
 * Checks whether the authenticated user's role has ALL of the specified permissions.
 *
 * Usage: router.get('/route', authenticate, requirePermission('VIEW_REPORTS'), handler)
 *
 * @param {...string} permissions - Required permission names
 * @returns {import('express').RequestHandler}
 */
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        status: 401,
        message: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const missing = permissions.filter((p) => !userPermissions.includes(p));

    if (missing.length > 0) {
      return sendError(res, {
        status: 403,
        message: `Access denied. Missing permission(s): ${missing.join(', ')}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
}

/**
 * Check if a role has a specific permission (utility function for services).
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

module.exports = { requirePermission, hasPermission };
