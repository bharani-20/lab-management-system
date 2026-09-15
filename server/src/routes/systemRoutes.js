'use strict';

const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createSystemSchema, updateSystemSchema } = require('../validators/systemValidator');
const { USER_ROLE } = require('../utils/constants');

// System heartbeat & dynamic IP reporting (Student Client / System LAN)
router.post('/heartbeat', systemController.recordSystemHeartbeat);

// Public system list for student client machine registration check
router.get('/info', systemController.getSystemInfo);
router.get('/', systemController.listSystems);
router.get('/:id', systemController.getSystemById);

// Admin-only management operations
router.post('/', authenticate, authorize(USER_ROLE.ADMIN), validate(createSystemSchema), systemController.createSystem);
router.put('/:id', authenticate, authorize(USER_ROLE.ADMIN), validate(updateSystemSchema), systemController.updateSystem);
router.delete('/:id', authenticate, authorize(USER_ROLE.ADMIN), systemController.deleteSystem);

module.exports = router;
