'use strict';

const systemService = require('../services/systemService');
const { sendSuccess } = require('../utils/response');
const { extractClientIp } = require('../utils/ipHelper');

async function listSystems(req, res, next) {
  try {
    const result = await systemService.listSystems(req.query);
    return sendSuccess(res, result.systems, 'Systems retrieved.', 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getSystemById(req, res, next) {
  try {
    const system = await systemService.getSystemById(req.params.id);
    return sendSuccess(res, system, 'System retrieved.');
  } catch (err) {
    next(err);
  }
}

async function createSystem(req, res, next) {
  try {
    const system = await systemService.createSystem(req.body);
    return sendSuccess(res, system, 'System created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

async function updateSystem(req, res, next) {
  try {
    const system = await systemService.updateSystem(req.params.id, req.body);
    return sendSuccess(res, system, 'System updated successfully.');
  } catch (err) {
    next(err);
  }
}

async function deleteSystem(req, res, next) {
  try {
    await systemService.deleteSystem(req.params.id);
    return sendSuccess(res, null, 'System deleted successfully.');
  } catch (err) {
    next(err);
  }
}

async function recordSystemHeartbeat(req, res, next) {
  try {
    const { systemCode, hostname, ipAddress } = req.body;
    const clientIp = extractClientIp(req, ipAddress);
    const system = await systemService.recordSystemHeartbeat(systemCode, clientIp, hostname);
    return sendSuccess(res, system, 'System heartbeat and IP registered.');
  } catch (err) {
    next(err);
  }
}

async function getSystemInfo(req, res, next) {
  try {
    const clientIp = extractClientIp(req, req.query?.ipAddress);
    const info = await systemService.getSystemInfo(req.query, clientIp);
    return sendSuccess(res, info, 'System info retrieved.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSystems,
  getSystemById,
  getSystemInfo,
  createSystem,
  updateSystem,
  deleteSystem,
  recordSystemHeartbeat,
};

