'use strict';

const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/response');

async function getDashboardStats(req, res, next) {
  try {
    const stats = await dashboardService.getDashboardStats();
    return sendSuccess(res, stats, 'Dashboard statistics retrieved.');
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };
