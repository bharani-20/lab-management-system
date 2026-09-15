'use strict';

const express = require('express');
const { healthCheck } = require('../controllers/healthController');

const router = express.Router();

// GET /api/health
router.get('/health', healthCheck);

module.exports = router;
