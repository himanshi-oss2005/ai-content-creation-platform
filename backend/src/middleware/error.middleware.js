const { nodeEnv } = require('../utils/config');
const logger = require('../utils/logger');

const globalErrorHandler = (err, req, res, _next) => {
  const status = err.statusCode || 500;

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  const message = err.isOperational ? err.message : 'Internal server error';

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack, url: req.originalUrl });
  }

  res.status(status).json({
    error: message,
    ...(nodeEnv === 'development' && { stack: err.stack }),
  });
};

module.exports = { globalErrorHandler };
