const express = require('express');
const { authenticate, enforceJson, generateRateLimiter } = require('../middleware/auth.middleware');
const { contentRules, toneComparisonRules, regenerateRules, bulkExportRules, historyQueryRules, objectIdParam, validate } = require('../middleware/validate.middleware');
const { getSharedContent, generate, generateAB, generateToneComparison, regenerate, selectABVariant, bulkExport, getHistory, getStats, updateContent, deleteContent, toggleFavorite, toggleShare } = require('../controllers/content.controller');

const router = express.Router();

router.get('/share/:token',          getSharedContent);
router.use(authenticate);
router.post('/generate',             enforceJson, generateRateLimiter, ...contentRules, validate, generate);
router.post('/generate/ab',          enforceJson, generateRateLimiter, ...contentRules, validate, generateAB);
router.post('/generate/tone-compare',enforceJson, generateRateLimiter, ...toneComparisonRules, validate, generateToneComparison);
router.post('/regenerate',           enforceJson, generateRateLimiter, ...regenerateRules, validate, regenerate);
router.post('/ab/select',            enforceJson, selectABVariant);
router.post('/bulk-export',          enforceJson, ...bulkExportRules, validate, bulkExport);
router.get('/history',               historyQueryRules, validate, getHistory);
router.get('/stats',                 getStats);
router.patch('/:id',                 enforceJson, ...objectIdParam('id'), validate, updateContent);
router.delete('/:id',                enforceJson, ...objectIdParam('id'), validate, deleteContent);
router.patch('/:id/favorite',        enforceJson, ...objectIdParam('id'), validate, toggleFavorite);
router.patch('/:id/share',           enforceJson, ...objectIdParam('id'), validate, toggleShare);

module.exports = router;
