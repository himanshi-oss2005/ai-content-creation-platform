const crypto   = require('crypto');
const AppError = require('../utils/AppError');
const { isProd } = require('../utils/config');

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-xsrf-token';
const TOKEN_BYTES = 32;

/**
 * Generates a cryptographically random CSRF token and sets it as a
 * non-httpOnly cookie so the frontend JS can read and echo it back
 * in the X-XSRF-Token request header (double-submit cookie pattern).
 */
const setCsrfCookie = (req, res, next) => {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure:   isProd,
      sameSite: 'lax',
      path:     '/',
      maxAge:   4 * 60 * 60 * 1000,
    });
  }
  next();
};

/**
 * Validates that the X-XSRF-Token header matches the XSRF-TOKEN cookie.
 * Uses timingSafeEqual to prevent timing attacks.
 */
const requireCsrfHeader = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (
    !cookieToken ||
    !headerToken ||
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    cookieToken.length !== headerToken.length
  ) {
    return next(new AppError('Invalid or missing CSRF token', 403));
  }

  try {
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      return next(new AppError('CSRF token mismatch', 403));
    }
  } catch {
    return next(new AppError('CSRF token validation failed', 403));
  }

  next();
};

module.exports = { setCsrfCookie, requireCsrfHeader };
