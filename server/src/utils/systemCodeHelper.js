'use strict';

/**
 * Normalizes any system number/code input into the standard 'PC-XX' format (e.g. 'PC-01' ... 'PC-64').
 * Handles variations like:
 * - 'LAB1-PC05' -> 'PC-05'
 * - 'LAB-PC-05' -> 'PC-05'
 * - 'pc-5' -> 'PC-05'
 * - 'PC5' -> 'PC-05'
 * - '5' -> 'PC-05'
 * - 'PC-01' -> 'PC-01'
 *
 * @param {string|number} rawCode
 * @returns {string}
 */
function normalizeSystemCode(rawCode) {
  if (rawCode === undefined || rawCode === null) return '';
  const str = String(rawCode).trim().toUpperCase();
  if (!str) return '';

  // Match pattern containing PC followed by optional separator and digits
  const pcMatch = str.match(/PC[-_]?(\d+)/i);
  if (pcMatch) {
    const num = parseInt(pcMatch[1], 10);
    if (!isNaN(num)) {
      return `PC-${String(num).padStart(2, '0')}`;
    }
  }

  // Pure numeric (e.g. 5 or "5" or "05")
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return `PC-${String(num).padStart(2, '0')}`;
  }

  // Fallback: return trimmed uppercase string
  return str;
}

module.exports = {
  normalizeSystemCode,
};
