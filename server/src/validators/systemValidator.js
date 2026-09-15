'use strict';

const { z } = require('zod');
const { SYSTEM_STATUS } = require('../utils/constants');

const createSystemSchema = z.object({
  systemCode: z.string().min(1, 'systemCode is required').max(50),
  hostname: z.string().max(100).optional(),
  ipAddress: z.string().max(50).optional(),
  status: z.nativeEnum(SYSTEM_STATUS).optional(),
});

const updateSystemSchema = z.object({
  systemCode: z.string().min(1).max(50).optional(),
  hostname: z.string().max(100).optional().nullable(),
  ipAddress: z.string().max(50).optional().nullable(),
  status: z.nativeEnum(SYSTEM_STATUS).optional(),
});

module.exports = { createSystemSchema, updateSystemSchema };
