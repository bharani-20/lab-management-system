'use strict';

const { z } = require('zod');

const createStudentSchema = z.object({
  registrationNo: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  section: z.string().min(1).max(10),
  year: z.number().int().min(1).max(5),
});

const updateStudentSchema = createStudentSchema.partial();

const studentPresenceQuerySchema = z.object({
  date: z.string().optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  year: z.coerce.number().int().min(1).max(5).optional(),
  system: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
  registrationNo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { createStudentSchema, updateStudentSchema, studentPresenceQuerySchema };
