const User = require('../models/User');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const config = require('../utils/config');
const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key' &&
  process.env.STRIPE_PREMIUM_PRICE_ID &&
  process.env.STRIPE_PREMIUM_PRICE_ID !== 'your_stripe_premium_price_id'
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const PREMIUM_CREDITS = parseInt(process.env.PREMIUM_DAILY_CREDITS) || 100;
const FREE_CREDITS = parseInt(process.env.FREE_DAILY_CREDITS) || 10;
const isDev = config.nodeEnv !== 'production';

exports.createCheckoutSession = asyncHandler(async (req, res) => {
  const user = req.user;

  // Mock mode — instant upgrade without Stripe
  if (!stripe) {
    await User.findByIdAndUpdate(user._id, { role: 'premium', credits: PREMIUM_CREDITS });
    await Transaction.create({
      user: user._id,
      type: 'purchase',
      amount: PREMIUM_CREDITS,
      description: 'Premium subscription (mock)',
      status: 'completed',
    });
    return res.json({ success: true, mock: true, message: 'Upgraded to Premium! (mock mode)' });
  }

  const frontendUrl = config.frontendUrlPrimary;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
      success_url: new URL('/dashboard?upgraded=true', frontendUrl).toString(),
      cancel_url:  new URL('/pricing?cancelled=true', frontendUrl).toString(),
      metadata: { userId: user._id.toString() },
    });
  } catch (stripeErr) {
    logger.error('stripe_checkout_error', {
      message: stripeErr.message,
      type: stripeErr.type,
      code: stripeErr.code,
      param: stripeErr.param,
      statusCode: stripeErr.statusCode,
      priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    });

    const clientMessage = isDev
      ? `Stripe checkout failed: ${stripeErr.message}`
      : 'Payment service error. Please try again.';

    throw new AppError(clientMessage, 400);
  }

  const checkoutUrl = String(session.url || '');
  try {
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('stripe.com')) {
      throw new Error('Unsafe checkout URL');
    }
  } catch (err) {
    logger.error('stripe_checkout_url_invalid', { url: checkoutUrl, error: err.message });
    throw new AppError('Payment redirect URL is not trusted', 502);
  }

  res.json({ url: checkoutUrl });
});

exports.handleWebhook = asyncHandler(async (req, res) => {
  if (!stripe) return res.json({ received: true });

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    logger.error('stripe_webhook_missing_signature', {
      path: req.path,
      method: req.method,
      payloadSize: req.body ? req.body.length : 0,
    });
    throw new AppError('Missing Stripe signature header', 400);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('stripe_webhook_missing_secret', { path: req.path, method: req.method });
    throw new AppError('Stripe webhook secret is not configured', 500);
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error('stripe_webhook_verification_failed', {
      path: req.path,
      method: req.method,
      signature: sig?.slice(0, 20),
      secretConfigured: Boolean(webhookSecret),
      error: err.message,
    });
    throw new AppError('Webhook signature verification failed', 400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await User.findByIdAndUpdate(session.metadata.userId, {
      role: 'premium',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: 'active',
      credits: PREMIUM_CREDITS,
    });
    await Transaction.create({
      user: session.metadata.userId,
      type: 'purchase',
      amount: PREMIUM_CREDITS,
      description: 'Premium subscription activated',
      stripePaymentIntentId: session.payment_intent,
      status: 'completed',
    });
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    if (user && subscription.status === 'active') {
      await User.findByIdAndUpdate(user._id, {
        role: 'premium',
        subscriptionStatus: 'active',
        credits: PREMIUM_CREDITS,
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await User.findOneAndUpdate(
      { stripeSubscriptionId: sub.id },
      { role: 'free', subscriptionStatus: 'cancelled', credits: FREE_CREDITS }
    );
  }

  res.json({ received: true });
});

exports.cancelSubscription = asyncHandler(async (req, res) => {
  const user = req.user;
  if (stripe && user.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
  }
  await User.findByIdAndUpdate(user._id, {
    role: 'free',
    subscriptionStatus: 'cancelled',
    credits: FREE_CREDITS,
  });
  res.json({ message: 'Subscription cancelled successfully' });
});
