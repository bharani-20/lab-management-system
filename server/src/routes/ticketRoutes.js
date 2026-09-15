'use strict';

const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createTicketSchema, updateTicketStatusSchema } = require('../validators/ticketValidator');
const { USER_ROLE } = require('../utils/constants');

// Public ticket submission (Student Kiosk problem reporting)
router.post('/', validate(createTicketSchema), ticketController.createTicket);

// Staff / Admin ticket management (Protected)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.FACULTY, USER_ROLE.NON_TEACHING_STAFF),
  ticketController.listTickets
);

router.get(
  '/:id',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.FACULTY, USER_ROLE.NON_TEACHING_STAFF),
  ticketController.getTicketById
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.FACULTY, USER_ROLE.NON_TEACHING_STAFF),
  validate(updateTicketStatusSchema),
  ticketController.updateTicketStatus
);

router.put(
  '/:id',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.FACULTY, USER_ROLE.NON_TEACHING_STAFF),
  validate(updateTicketStatusSchema),
  ticketController.updateTicketStatus
);

module.exports = router;
