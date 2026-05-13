const { body, query, param, validationResult } = require('express-validator');

// ── Core validator ────────────────────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array({ onlyFirstError: true }) });
  }
  next();
};

// ── Auth rules ────────────────────────────────────────────────────────────────

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 80 }).withMessage('Name must be under 80 characters')
    .escape(),

  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email too long'),

  body('password')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),
];

const loginRules = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password too long'),
];

const forgotPasswordRules = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),
];

const resetPasswordRules = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 6, max: 128 }).withMessage('Password must be 6–128 characters'),
];

const verifyEmailRules = [
  query('token')
    .notEmpty().withMessage('Verification token is required'),
];

const promptHistoryRules = [
  body('prompt')
    .trim()
    .notEmpty().withMessage('Prompt is required')
    .isLength({ max: 500 }).withMessage('Prompt must be 500 characters or fewer'),
];

// ── Content generation rules ──────────────────────────────────────────────────

const CONTENT_TYPES = ['blog', 'ad', 'caption', 'product_description', 'email', 'tagline'];
const TONES         = ['professional', 'casual', 'marketing', 'funny', 'formal'];
const LENGTHS       = ['short', 'medium', 'long'];

const contentRules = [
  body('type').isIn(CONTENT_TYPES).withMessage('Invalid content type'),
  body('tone').isIn(TONES).withMessage('Invalid tone'),
  body('prompt').trim().isLength({ min: 5, max: 500 }).withMessage('Prompt must be 5–500 characters'),
  body('length').optional().isIn(LENGTHS).withMessage('Length must be short, medium, or long'),
  body('language').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Language must be 2–30 characters').matches(/^[a-zA-Z\s\-]+$/).withMessage('Language contains invalid characters'),
  body('keywords').optional().isArray({ max: 10 }).withMessage('Keywords must be an array of up to 10 items'),
  body('keywords.*').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Each keyword must be 1–50 characters').escape(),
  body('wordCount').optional().isInt({ min: 10, max: 5000 }).withMessage('Word count must be between 10 and 5000').toInt(),
];

const regenerateRules = [
  body('contentId').isMongoId().withMessage('contentId must be a valid MongoDB ObjectId'),
  body('tone').optional().isIn(TONES).withMessage('Invalid tone'),
  body('length').optional().isIn(LENGTHS).withMessage('Length must be short, medium, or long'),
  body('keywords').optional().isArray({ max: 10 }).withMessage('Keywords must be an array of up to 10 items'),
  body('keywords.*').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Each keyword must be 1–50 characters').escape(),
  body('wordCount').optional().isInt({ min: 10, max: 5000 }).withMessage('Word count must be between 10 and 5000').toInt(),
];

const toneComparisonRules = [
  body('type').isIn(CONTENT_TYPES).withMessage('Invalid content type'),
  body('tones').isArray({ min: 2, max: 3 }).withMessage('tones must be an array of 2–3 items').custom((arr) => arr.every((t) => TONES.includes(t))).withMessage('Each tone must be valid'),
  body('prompt').trim().isLength({ min: 5, max: 500 }).withMessage('Prompt must be 5–500 characters'),
  body('length').optional().isIn(LENGTHS).withMessage('Length must be short, medium, or long'),
  body('language').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Language must be 2–30 characters').matches(/^[a-zA-Z\s\-]+$/).withMessage('Language contains invalid characters'),
  body('keywords').optional().isArray({ max: 10 }).withMessage('Keywords must be an array of up to 10 items'),
  body('keywords.*').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Each keyword must be 1–50 characters').escape(),
  body('wordCount').optional().isInt({ min: 10, max: 5000 }).withMessage('Word count must be between 10 and 5000').toInt(),
];

// ── History query rules ───────────────────────────────────────────────────────

const historyQueryRules = [
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1–50').toInt(),
  query('type').optional().isIn([...CONTENT_TYPES, '']).withMessage('Invalid content type filter'),
  query('search').optional().trim().isLength({ max: 100 }).withMessage('Search query too long'),
  query('favorites').optional().isIn(['true', 'false']).withMessage('favorites must be true or false'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid ISO date'),
  query('collection').optional().custom((v) => v === 'none' || /^[a-f\d]{24}$/i.test(v)).withMessage('collection must be a valid ObjectId or "none"'),
];

// ── MongoDB ObjectId param rule ───────────────────────────────────────────────

const objectIdParam = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
];

// ── Template rules ────────────────────────────────────────────────────────────

const templateRules = [
  body('name').trim().notEmpty().withMessage('Template name is required').isLength({ max: 100 }).withMessage('Name must be under 100 characters').escape(),
  body('type').isIn(CONTENT_TYPES).withMessage('Invalid content type'),
  body('prompt').trim().notEmpty().withMessage('Prompt is required').isLength({ max: 500 }).withMessage('Prompt must be under 500 characters'),
  body('description').optional().trim().isLength({ max: 300 }).withMessage('Description must be under 300 characters').escape(),
  body('tone').optional().isIn(TONES).withMessage('Invalid tone'),
  body('length').optional().isIn(LENGTHS).withMessage('Invalid length'),
];

const updateTemplateRules = [
  body('name').optional().trim().notEmpty().withMessage('Template name cannot be empty').isLength({ max: 100 }).withMessage('Name must be under 100 characters').escape(),
  body('type').optional().isIn(CONTENT_TYPES).withMessage('Invalid content type'),
  body('prompt').optional().trim().notEmpty().withMessage('Prompt cannot be empty').isLength({ max: 500 }).withMessage('Prompt must be under 500 characters'),
  body('description').optional().trim().isLength({ max: 300 }).withMessage('Description must be under 300 characters').escape(),
  body('tone').optional().isIn(TONES).withMessage('Invalid tone'),
  body('length').optional().isIn(LENGTHS).withMessage('Invalid length'),
  body('language').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Language must be 2–30 characters').matches(/^[a-zA-Z\s\-]+$/).withMessage('Language contains invalid characters'),
  body('keywords').optional().isArray({ max: 10 }).withMessage('Keywords must be an array of up to 10 items'),
  body('keywords.*').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Each keyword must be 1–50 characters').escape(),
];

// ── Collection rules ──────────────────────────────────────────────────────────

const collectionRules = [
  body('name').trim().notEmpty().withMessage('Collection name is required').isLength({ max: 60 }).withMessage('Name must be under 60 characters').escape(),
  body('color').optional().isIn(['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink']).withMessage('Invalid color'),
  body('icon').optional().trim().isLength({ max: 4 }).withMessage('Icon must be a single emoji'),
];

const collectionUpdateRules = [
  body('name').optional().trim().notEmpty().withMessage('Collection name is required').isLength({ max: 60 }).withMessage('Name must be under 60 characters').escape(),
  body('color').optional().isIn(['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink']).withMessage('Invalid color'),
  body('icon').optional().trim().isLength({ max: 4 }).withMessage('Icon must be a single emoji'),
];

// ── Bulk export rules ─────────────────────────────────────────────────────────

const bulkExportRules = [
  body('ids').isArray({ min: 1, max: 50 }).withMessage('ids must be an array of 1–50 items'),
  body('ids.*').isMongoId().withMessage('Each id must be a valid MongoDB ObjectId'),
  body('format').isIn(['zip', 'pdf']).withMessage('format must be zip or pdf'),
];

// ── Change password rules ─────────────────────────────────────────────────────

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6, max: 128 }).withMessage('New password must be 6–128 characters'),
  body('confirmPassword').custom((val, { req }) => val === req.body.newPassword).withMessage('Passwords do not match'),
];

// ── Profile update rules ──────────────────────────────────────────────────────

const profileUpdateRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }).withMessage('Name must be under 80 characters').escape(),
];

const transactionQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
];

// ── Admin rules ───────────────────────────────────────────────────────────────

const adminRoleRules = [
  body('role').isIn(['free', 'premium']).withMessage('Role must be free or premium'),
];

const adminSearchRules = [
  query('search').optional().trim().isLength({ max: 100 }).withMessage('Search query too long').escape(),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1–50').toInt(),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  contentRules,
  regenerateRules,
  historyQueryRules,
  objectIdParam,
  templateRules,
  collectionRules,
  collectionUpdateRules,
  changePasswordRules,
  profileUpdateRules,
  promptHistoryRules,
  transactionQueryRules,
  verifyEmailRules,
  adminRoleRules,
  adminSearchRules,
  bulkExportRules,
  toneComparisonRules,
  updateTemplateRules,
};
