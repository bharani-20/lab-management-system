'use strict';

const { z } = require('zod');

const createTicketSchema = z.object({
  systemNumber: z.string().max(50).optional(),
  systemCode: z.string().max(50).optional(),
  systemId: z.string().max(100).optional(),
  category: z.string().min(1, 'Category is required').max(100),
  description: z.string().min(1, 'Description is required').max(1000),
  studentName: z.string().max(100).optional(),
  registerNumber: z.string().max(50).optional(),
  registrationNo: z.string().max(50).optional(),
});

const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], {
    errorMap: () => ({ message: 'Status must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED' }),
  }),
});

module.exports = {
  createTicketSchema,
  updateTicketStatusSchema,
};
