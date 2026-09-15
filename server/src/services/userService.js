'use strict';

const bcrypt = require('bcryptjs');
const { prisma } = require('../config/database');
const { createError } = require('../middleware/errorMiddleware');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const SALT_ROUNDS = 12;

// Safe user selector — never return passwordHash
const SAFE_USER_SELECT = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * List all users (Admin only).
 */
async function listUsers(query = {}) {
  const { page, limit, skip } = parsePagination(query);
  const { role, isActive, search } = query;

  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      skip,
      take: limit,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    }),
    prisma.user.count({ where }),
  ]);

  return { users, pagination: buildPaginationMeta(total, page, limit) };
}

/**
 * Get a single user by ID (Admin only).
 */
async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  if (!user) throw createError('User not found.', 404, 'USER_NOT_FOUND');
  return user;
}

/**
 * Create a new user (Admin only).
 */
async function createUser(data) {
  const { username, password, name, role } = data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw createError(`Username "${username}" is already taken.`, 409, 'DUPLICATE_USERNAME');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.create({
    data: { username, passwordHash, name, role, isActive: true },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Update a user (Admin only).
 * Prevents role escalation by the requesting user for themselves.
 */
async function updateUser(id, data, requestingUserId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found.', 404, 'USER_NOT_FOUND');

  // Prevent a user from changing their own role
  if (data.role && id === requestingUserId) {
    throw createError('You cannot change your own role.', 403, 'SELF_ROLE_ESCALATION');
  }

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.role) updateData.role = data.role;
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  return prisma.user.update({ where: { id }, data: updateData, select: SAFE_USER_SELECT });
}

/**
 * Enable or disable a user account (Admin only).
 * Protects the last active admin from being deactivated.
 */
async function updateUserStatus(id, isActive, requestingUserId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found.', 404, 'USER_NOT_FOUND');

  // Prevent deactivating yourself
  if (id === requestingUserId && !isActive) {
    throw createError('You cannot deactivate your own account.', 403, 'SELF_DEACTIVATION');
  }

  // Protect last active admin
  if (user.role === 'ADMIN' && !isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw createError(
        'Cannot deactivate the last active administrator.',
        403,
        'LAST_ADMIN_PROTECTION'
      );
    }
  }

  return prisma.user.update({ where: { id }, data: { isActive }, select: SAFE_USER_SELECT });
}

/**
 * Delete a user (Admin only).
 * Protects the last active admin from being deleted.
 */
async function deleteUser(id, requestingUserId) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found.', 404, 'USER_NOT_FOUND');

  // Prevent self-deletion
  if (id === requestingUserId) {
    throw createError('You cannot delete your own account.', 403, 'SELF_DELETION');
  }

  // Protect last active admin
  if (user.role === 'ADMIN' && user.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw createError(
        'Cannot delete the last active administrator.',
        403,
        'LAST_ADMIN_PROTECTION'
      );
    }
  }

  return prisma.user.delete({ where: { id } });
}

module.exports = { listUsers, getUserById, createUser, updateUser, updateUserStatus, deleteUser };
