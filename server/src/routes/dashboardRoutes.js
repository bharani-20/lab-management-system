'use strict';

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_ROLE } = require('../utils/constants');

// Dashboard statistics strictly restricted to ADMIN
router.get('/stats', authenticate, authorize(USER_ROLE.ADMIN), dashboardController.getDashboardStats);

module.exports = router;
