const express = require('express');
const { authenticate, enforceJson } = require('../middleware/auth.middleware');
const { profileUpdateRules, changePasswordRules, promptHistoryRules, transactionQueryRules, validate } = require('../middleware/validate.middleware');
const { getProfile, updateProfile, changePassword, getCredits, getTransactions, getPromptHistory, addPromptHistory } = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);
router.get('/profile',          getProfile);
router.patch('/profile',        enforceJson, profileUpdateRules, validate, updateProfile);
router.post('/change-password', enforceJson, changePasswordRules, validate, changePassword);
router.get('/credits',          getCredits);
router.get('/transactions',     transactionQueryRules, validate, getTransactions);
router.get('/prompt-history',   getPromptHistory);
router.post('/prompt-history',  enforceJson, promptHistoryRules, validate, addPromptHistory);

module.exports = router;
