'use strict';

const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

/**
 * POST /api/auth/login
 * Public endpoint. Rate-limited.
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    return sendSuccess(res, {
      status: 200,
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Requires authentication.
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);

    return sendSuccess(res, {
      status: 200,
      message: 'User retrieved successfully',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, getMe };
