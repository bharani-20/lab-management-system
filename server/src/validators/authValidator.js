'use strict';

const { z } = require('zod');

const loginSchema = z.object({
  username: z
    .string({ required_error: 'Username is required' })
    .min(1, 'Username cannot be empty')
    .max(50, 'Username too long'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty')
    .max(128, 'Password too long'),
});

module.exports = { loginSchema };
