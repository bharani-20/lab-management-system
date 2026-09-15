'use strict';

const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Public system info endpoint for student kiosk polling
router.get('/info', systemController.getSystemInfo);

module.exports = router;
