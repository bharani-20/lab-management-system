'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/sessions', reportController.getSessionsReport);
router.get('/attendance', reportController.getAttendanceReport);
router.get('/systems', reportController.getSystemUsageReport);
router.get('/students', reportController.getStudentUsageReport);

module.exports = router;
