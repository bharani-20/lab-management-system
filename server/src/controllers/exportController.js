'use strict';

const exportService = require('../services/exportService');

async function exportSessions(req, res, next) {
  try {
    await exportService.exportSessions(req.query, res);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportSessions };
