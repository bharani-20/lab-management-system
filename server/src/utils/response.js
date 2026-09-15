'use strict';

/**
 * Standard API response helpers.
 * Supports both:
 * 1) Positional: sendSuccess(res, data, message, status, pagination)
 * 2) Options object: sendSuccess(res, { status, message, data, pagination })
 */
function sendSuccess(res, dataOrOptions = {}, message = 'Success', status = 200, pagination) {
  let finalData = dataOrOptions;
  let finalMessage = message;
  let finalStatus = status;
  let finalPagination = pagination;

  if (
    dataOrOptions &&
    typeof dataOrOptions === 'object' &&
    !Array.isArray(dataOrOptions) &&
    typeof dataOrOptions.status === 'number' &&
    ('data' in dataOrOptions || 'message' in dataOrOptions)
  ) {
    finalData = dataOrOptions.data !== undefined ? dataOrOptions.data : {};
    finalMessage = dataOrOptions.message || 'Success';
    finalStatus = dataOrOptions.status;
    finalPagination = dataOrOptions.pagination;
  }

  const body = { success: true, message: finalMessage, data: finalData };
  if (finalPagination) body.pagination = finalPagination;
  return res.status(finalStatus).json(body);
}

/**
 * Send an error response.
 * Supports both:
 * 1) Options object: sendError(res, { status, message, code, details })
 * 2) Positional: sendError(res, message, status, code, details)
 */
function sendError(res, optionsOrMessage = {}, status = 500, code = 'INTERNAL_ERROR', details) {
  let finalStatus = status;
  let finalMessage = typeof optionsOrMessage === 'string' ? optionsOrMessage : 'An error occurred';
  let finalCode = code;
  let finalDetails = details;

  if (optionsOrMessage && typeof optionsOrMessage === 'object') {
    finalStatus = optionsOrMessage.status || 500;
    finalMessage = optionsOrMessage.message || 'An error occurred';
    finalCode = optionsOrMessage.code || 'INTERNAL_ERROR';
    finalDetails = optionsOrMessage.details;
  }

  const body = {
    success: false,
    message: finalMessage,
    errorCode: finalCode,
    error: { code: finalCode },
  };
  if (finalDetails !== undefined) {
    body.details = finalDetails;
    body.error.details = finalDetails;
  }
  return res.status(finalStatus).json(body);
}

module.exports = { sendSuccess, sendError };
