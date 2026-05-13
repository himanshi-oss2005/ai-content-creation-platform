const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const config     = require('../utils/config');
const User       = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/notification.service');

const signToken = (id) =>
  jwt.sign({ id }, config.jwtSecret, {
    expiresIn:  config.jwtExpires,
    algorithm: 'HS256',
  });

const attachTokenCookie = (res, token) => {
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
};

// Dummy hash used to prevent timing attacks on non-existent users.
// bcrypt.compare against this ensures the response time is the same
// whether the user exists or not.
// Generated with: bcrypt.hashSync('__dummy__', 12)
const DUMMY_HASH = '$2a$12$SHe7z.oyIgtkqmyJCQmJoux4mArFfcBPF6n1ggkJs5hk8z8R3lTFu';

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email }).lean();
  if (existing) throw new AppError('Email already registered', 409);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await User.create({
    name, email, password,
    isEmailVerified:          true,
    emailVerificationToken:   undefined,
    emailVerificationExpires: undefined,
  });

  // await sendVerificationEmail(user, verifyToken);

  const message = 'Registration successful. You can now log in.';

  logger.info('user_registered', { userId: user._id.toString() });

  res.status(201).json({ message });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Always fetch with password so bcrypt timing is consistent
  const user = await User.findOne({ email }).select('+password');

  // Run bcrypt even when user is not found — prevents timing-based user enumeration
  const passwordMatch = user
    ? await user.comparePassword(password)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

  if (!user || !passwordMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  // Verification check disabled by request
  /*
  if (!user.isEmailVerified && config.isProd) {
    throw new AppError('Please verify your email before logging in', 403);
  }
  */

  const token = signToken(user._id);
  attachTokenCookie(res, token);

  // Never send password hash in response
  user.password = undefined;

  logger.info('user_login', { userId: user._id.toString() });

  res.json({ token, user });
});

exports.getMe = asyncHandler(async (req, res) => {
  const wasReset = req.user.resetDailyCreditsIfNeeded();
  if (wasReset) await req.user.save();
  res.json({ user: req.user });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond with the same message to prevent user enumeration
  const MSG = 'If that email is registered, a reset link has been sent.';

  if (!user) return res.json({ message: MSG });

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save();

  await sendPasswordResetEmail(user, rawToken);
  logger.info('password_reset_requested', { userId: user._id.toString() });

  res.json({ message: MSG });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');

  const user = await User.findOne({
    passwordResetToken:   { $eq: hashed },
    passwordResetExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) throw new AppError('Invalid or expired reset link', 400);

  user.password             = req.body.password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  logger.info('password_reset_completed', { userId: user._id.toString() });
  res.json({ message: 'Password reset successful. You can now log in.' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const hashed = crypto.createHash('sha256').update(String(req.query.token || '')).digest('hex');

  const user = await User.findOne({
    emailVerificationToken:   { $eq: hashed },
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) throw new AppError('Invalid or expired verification link', 400);

  user.isEmailVerified          = true;
  user.emailVerificationToken   = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  logger.info('email_verified', { userId: user._id.toString() });

  const token = signToken(user._id);
  attachTokenCookie(res, token);
  res.json({ message: 'Email verified successfully.', token, user });
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'strict',
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
});
