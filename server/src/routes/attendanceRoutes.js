'use strict';

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/authMiddleware');
const { USER_ROLE } = require('../utils/constants');

// View attendance (ADMIN, FACULTY, NON_TEACHING_STAFF - Protected)
router.get(
  '/',
  authenticate,
  authorize(USER_ROLE.ADMIN, USER_ROLE.FACULTY, USER_ROLE.NON_TEACHING_STAFF),
  attendanceController.listAttendance
);

// End session routes for student client compatibility
router.put('/:id/end', attendanceController.endAttendanceSession);
router.patch('/:id/end', attendanceController.endAttendanceSession);
router.post('/:id/end', attendanceController.endAttendanceSession);
router.post('/end', attendanceController.endAttendanceSession);

// Record attendance:
// - Student kiosk: starts session & records attendance without JWT
// - Admin/Faculty: records manual attendance with JWT
router.post('/', optionalAuthenticate, attendanceController.recordAttendance);

module.exports = router;
