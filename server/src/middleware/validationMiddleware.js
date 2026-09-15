'use strict';

const { sendError } = require('../utils/response');

/**
 * Validation middleware factory.
 * Validates the request body against a Zod schema.
 * Returns 422 with field-level errors on failure.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} [source='body']
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return sendError(res, {
        status: 422,
        message: 'Validation failed. Check the provided data.',
        code: 'VALIDATION_ERROR',
        details,
      });
    }

    // Replace request data with parsed/coerced data
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
