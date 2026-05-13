const express = require('express');
const { requireCsrfHeader } = require('../middleware/csrf.middleware');
const { enforceJson, authRateLimiter, authenticate } = require('../middleware/auth.middleware');
const { register, login, forgotPassword, resetPassword, getMe, verifyEmail, logout } = require('../controllers/auth.controller');
const { registerRules, loginRules, forgotPasswordRules, resetPasswordRules, verifyEmailRules, validate } = require('../middleware/validate.middleware');

const router = express.Router();

router.use(requireCsrfHeader);
router.post('/register',        enforceJson, requireCsrfHeader, authRateLimiter, ...registerRules,       validate, register);
router.post('/login',           enforceJson, requireCsrfHeader, authRateLimiter, ...loginRules,          validate, login);
router.post('/logout',          enforceJson, requireCsrfHeader, authenticate, logout);
router.post('/forgot-password', enforceJson, requireCsrfHeader, authRateLimiter, ...forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password',  enforceJson, requireCsrfHeader, authRateLimiter, ...resetPasswordRules,  validate, resetPassword);
router.get('/me',               requireCsrfHeader, authenticate, getMe);
router.get('/verify-email',     requireCsrfHeader, verifyEmailRules, validate, verifyEmail);

module.exports = router;
