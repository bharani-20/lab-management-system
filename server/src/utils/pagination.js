'use strict';

/**
 * Pagination helper.
 * Extracts and validates page/limit from query params.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Parse pagination parameters from request query.
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!page || page < 1) page = 1;
  if (!limit || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build pagination metadata object for API responses.
 * @param {number} total - Total record count
 * @param {number} page
 * @param {number} limit
 * @returns {object}
 */
function buildPaginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { parsePagination, buildPaginationMeta };
