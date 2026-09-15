'use strict';

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { validate } = require('../middleware/validationMiddleware');
const { syncSessionsBatchSchema } = require('../validators/sessionValidator');

// Public / Student Client offline sync endpoint
router.post('/sessions', validate(syncSessionsBatchSchema), syncController.syncSessions);

module.exports = router;
