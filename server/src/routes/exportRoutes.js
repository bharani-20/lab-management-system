'use strict';

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/sessions', authenticate, exportController.exportSessions);

module.exports = router;
