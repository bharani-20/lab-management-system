'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { loginSchema } = require('../validators/authValidator');

const router = express.Router();

// Strict rate limit for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.',
    error: { code: 'LOGIN_RATE_LIMITED' },
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), login);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

module.exports = router;
