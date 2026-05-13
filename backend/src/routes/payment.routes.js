const express = require('express');
const { authenticate, enforceJson } = require('../middleware/auth.middleware');
const { handleWebhook, createCheckoutSession, cancelSubscription } = require('../controllers/payment.controller');

const router = express.Router();

router.post('/webhook',  handleWebhook);
router.post('/checkout', authenticate, enforceJson, createCheckoutSession);
router.post('/cancel',   authenticate, enforceJson, cancelSubscription);

module.exports = router;
