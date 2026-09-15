'use strict';

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createSessionSchema } = require('../validators/sessionValidator');
const { USER_ROLE } = require('../utils/constants');

// Public / Student Client Endpoints
router.post('/', validate(createSessionSchema), sessionController.createSession);
router.patch('/:id/end', sessionController.endSession);
router.post('/heartbeat', sessionController.recordHeartbeat);

// Protected Dashboard / Admin / Staff Endpoints
router.get('/', authenticate, sessionController.listSessions);
router.get('/:id', authenticate, sessionController.getSessionById);
router.post('/reconcile', authenticate, authorize(USER_ROLE.ADMIN), sessionController.reconcileStaleSessions);

module.exports = router;
