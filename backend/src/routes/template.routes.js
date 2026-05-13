const express = require('express');
const { authenticate, enforceJson } = require('../middleware/auth.middleware');
const { templateRules, updateTemplateRules, objectIdParam, validate } = require('../middleware/validate.middleware');
const { listTemplates, createTemplate, updateTemplate, deleteTemplate, useTemplate } = require('../controllers/template.controller');

const router = express.Router();

router.use(authenticate);
router.get('/',         listTemplates);
router.post('/',        enforceJson, ...templateRules, validate, createTemplate);
router.patch('/:id',    enforceJson, ...objectIdParam('id'), ...updateTemplateRules, validate, updateTemplate);
router.delete('/:id',   enforceJson, ...objectIdParam('id'), validate, deleteTemplate);
router.post('/:id/use', enforceJson, ...objectIdParam('id'), validate, useTemplate);

module.exports = router;
