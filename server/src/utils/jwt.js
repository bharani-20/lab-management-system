'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Sign a JWT token.
 * @param {object} payload - Data to encode (userId, username, role)
 * @returns {string} Signed JWT string
 */
function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'lab-management-system',
  });
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'lab-management-system',
  });
}

module.exports = { signToken, verifyToken };
