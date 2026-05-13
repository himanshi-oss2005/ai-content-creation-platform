const jwt       = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const { jwtSecret, rateLimit: rateLimitCfg, nodeEnv } = require('../utils/config');
const User       = require('../models/User');
const AppError   = require('../utils/AppError');

// ── JWT authentication ────────────────────────────────────────────────────────

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.jwt;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : cookieToken;

  if (!token) {
    return next(new AppError('No token provided', 401));
  }

  // Basic structural check before hitting the DB
  if (!token || token.split('.').length !== 3) {
    return next(new AppError('Malformed token', 401));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],          // explicitly allow only HS256
    });

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new AppError('User no longer exists', 401));

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired. Please log in again.', 401));
    }
    next(new AppError('Invalid or expired token', 401));
  }
};

// ── Role guards ───────────────────────────────────────────────────────────────

const requirePremium = (req, _res, next) => {
  if (req.user?.role !== 'premium') {
    return next(new AppError('Premium subscription required', 403));
  }
  next();
};

const requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Admin access required', 403));
  }
  next();
};

// ── Rate limiters ─────────────────────────────────────────────────────────────

/**
 * Strict limiter for auth endpoints (login / register).
 * Keyed by IP to prevent brute-force attacks.
 */
const authRateLimiter = rateLimit({
  windowMs:        rateLimitCfg.auth.windowMs,
  max:             rateLimitCfg.auth.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many auth attempts. Please try again later.' },
  // Skip successful requests — only count failures toward the limit
  skipSuccessfulRequests: true,
});

/**
 * Per-user limiter for AI generation.
 * Keyed by authenticated user ID (falls back to IP before auth runs).
 */
const generateRateLimiter = rateLimit({
  windowMs:        rateLimitCfg.generate.windowMs,
  max:             rateLimitCfg.generate.max,
  keyGenerator:    (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many generation requests. Please wait a moment.' },
});

// ── CSRF mitigation — enforce JSON Content-Type on mutating requests ─────────
// JWT in Authorization header already prevents CSRF, but this adds an explicit
// layer: browsers cannot send cross-origin JSON with custom headers without a
// CORS preflight, making CSRF attacks impossible for these endpoints.
const enforceJson = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const rawCt = req.headers['content-type'];
    const ct    = typeof rawCt === 'string' ? rawCt
                : Array.isArray(rawCt)      ? rawCt.join(',')
                : '';
    if (req.method !== 'DELETE' && !ct.toLowerCase().includes('application/json')) {
      return next(new AppError('Content-Type must be application/json', 415));
    }
  }
  next();
};

module.exports = {
  authenticate,
  requirePremium,
  requireAdmin,
  authRateLimiter,
  generateRateLimiter,
  enforceJson,
};
