const express = require('express');
const Joi = require('joi');
const { authenticate, requireAdmin, enforceJson } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { getStats, getUsers, updateUserRole, getAnalytics } = require('../controllers/admin.controller');

const router = express.Router();

const adminSearchSchema = Joi.object({
  search: Joi.string().trim().max(100).allow('', null).optional(),
  page:   Joi.number().integer().min(1).default(1),
  limit:  Joi.number().integer().min(1).max(50).default(20),
});
const objectIdSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
const adminRoleSchema = Joi.object({ role: Joi.string().valid('free', 'premium').required() });

router.use(authenticate, requireAdmin);
router.get('/stats',            getStats);
router.get('/users',            validateRequest(adminSearchSchema, 'query'), getUsers);
router.patch('/users/:id/role', enforceJson, validateRequest(objectIdSchema, 'params'), validateRequest(adminRoleSchema), updateUserRole);
router.get('/analytics',        getAnalytics);

module.exports = router;
