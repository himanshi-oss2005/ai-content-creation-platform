/**
 * Wraps async route handlers to forward errors to Express error middleware,
 * eliminating repetitive try/catch blocks in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
