'use strict';

const { z } = require('zod');

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50).regex(
    /^[a-zA-Z0-9_.-]+$/,
    'Username can only contain letters, numbers, underscores, dots, and hyphens'
  ),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'FACULTY', 'NON_TEACHING_STAFF']),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'FACULTY', 'NON_TEACHING_STAFF']).optional(),
  password: z.string().min(6).max(128).optional(),
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive must be a boolean' }),
});

module.exports = { createUserSchema, updateUserSchema, updateUserStatusSchema };
