'use strict';

/**
 * Standard IPv4 format regex (0.0.0.0 to 255.255.255.255)
 */
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * Normalize an IP address:
 * - Strips IPv6-mapped IPv4 prefix ("::ffff:")
 * - Trims whitespace
 * - Normalizes IPv6 loopback ("::1") to IPv4 loopback ("127.0.0.1")
 *
 * @param {string} rawIp
 * @returns {string|null}
 */
function normalizeIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return null;
  let ip = rawIp.trim();

  // Strip IPv6-mapped IPv4 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Handle loopback addresses
  if (ip === '::1') {
    return '127.0.0.1';
  }

  return ip;
}

/**
 * Validates if the string is a valid IPv4 address.
 * Rejects malformed values (e.g. 999.999.999.999, non-numeric, empty).
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isValidIpv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const normalized = normalizeIp(ip);
  return IPV4_REGEX.test(normalized);
}

/**
 * Extracts the client IPv4 address from HTTP request or reported body.
 *
 * Precedence:
 * 1. Valid reported LAN IP in payload (from Windows client network adapter)
 * 2. Express req.headers['x-forwarded-for'] (first hop)
 * 3. Express req.ip
 * 4. req.socket.remoteAddress
 *
 * @param {import('express').Request} req
 * @param {string} [reportedIp]
 * @returns {string|null}
 */
function extractClientIp(req, reportedIp) {
  // If the client explicitly reports its local adapter LAN IP and it is valid IPv4
  if (reportedIp && isValidIpv4(reportedIp)) {
    return normalizeIp(reportedIp);
  }

  // Check proxy headers
  const xForwardedFor = req?.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0].trim();
    if (isValidIpv4(firstIp)) {
      return normalizeIp(firstIp);
    }
  }

  // Check Express req.ip
  if (req?.ip && isValidIpv4(req.ip)) {
    return normalizeIp(req.ip);
  }

  // Check socket remoteAddress
  const remoteAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
  if (remoteAddress && isValidIpv4(remoteAddress)) {
    return normalizeIp(remoteAddress);
  }

  return null;
}

module.exports = {
  IPV4_REGEX,
  normalizeIp,
  isValidIpv4,
  extractClientIp,
};
