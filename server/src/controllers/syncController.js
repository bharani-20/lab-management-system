'use strict';

const syncService = require('../services/syncService');
const { sendSuccess } = require('../utils/response');

async function syncSessions(req, res, next) {
  try {
    const { sessions } = req.body;
    const result = await syncService.syncSessionsBatch(sessions);
    return sendSuccess(res, result, 'Offline session batch sync completed.');
  } catch (err) {
    next(err);
  }
}

module.exports = { syncSessions };
