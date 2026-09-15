'use strict';

const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { timetableSchema } = require('../validators/timetableValidator');
const { USER_ROLE } = require('../utils/constants');

// Timetable viewing open to all authenticated roles
router.get('/', authenticate, timetableController.listTimetables);
router.get('/:id', authenticate, timetableController.getTimetableById);

// Admin-only CRUD operations
router.post('/', authenticate, authorize(USER_ROLE.ADMIN), validate(timetableSchema), timetableController.createTimetable);
router.put('/:id', authenticate, authorize(USER_ROLE.ADMIN), validate(timetableSchema), timetableController.updateTimetable);
router.delete('/:id', authenticate, authorize(USER_ROLE.ADMIN), timetableController.deleteTimetable);

module.exports = router;
