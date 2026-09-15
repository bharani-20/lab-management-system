'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { signToken } = require('../utils/jwt');
const { createError } = require('../middleware/errorMiddleware');

/**
 * Authenticate a user by username and password.
 * Returns JWT token and sanitized user object.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, user: object}>}
 */
async function login(username, password) {
  // Find user (include passwordHash for comparison)
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    throw createError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw createError('Account is deactivated. Contact the administrator.', 401, 'ACCOUNT_DEACTIVATED');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw createError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  // Never return passwordHash
  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  };

  return { token, user: safeUser };
}

/**
 * Get the currently authenticated user by ID.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw createError('User not found.', 404, 'USER_NOT_FOUND');
  }

  return user;
}

module.exports = { login, getMe };
