'use strict';

const { z } = require('zod');

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timetableShape = z.object({
  dayOfWeek: z.enum(DAYS, {
    errorMap: () => ({ message: `dayOfWeek must be one of: ${DAYS.join(', ')}` }),
  }),
  startTime: z
    .string()
    .regex(TIME_REGEX, 'startTime must be in HH:MM format (24h)'),
  endTime: z
    .string()
    .regex(TIME_REGEX, 'endTime must be in HH:MM format (24h)'),
  department: z.string().min(1).max(100),
  section: z.string().min(1).max(10),
  year: z.number().int().min(1).max(5),
  subject: z.string().min(1).max(100),
  facultyName: z.string().min(1).max(100),
  room: z.string().max(50).optional().nullable(),
});

const timetableSchema = timetableShape.refine(
  (data) => data.startTime < data.endTime,
  { message: 'startTime must be before endTime', path: ['startTime'] }
);

const updateTimetableSchema = timetableShape.partial().refine(
  (data) => {
    if (data.startTime && data.endTime) return data.startTime < data.endTime;
    return true;
  },
  { message: 'startTime must be before endTime', path: ['startTime'] }
);

module.exports = { timetableSchema, updateTimetableSchema };
