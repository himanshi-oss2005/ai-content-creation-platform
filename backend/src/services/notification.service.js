const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const config = require('../utils/config');

const THRESHOLD = 0.8;
const frontendUrl = config.frontendUrlPrimary;

function createTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!secure && port !== 587 && port !== 2587) {
    logger.warn('smtp_insecure_port', { port, message: 'Only ports 465 (TLS) and 587/2587 (STARTTLS) are permitted' });
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    requireTLS: true,
    opportunisticTLS: false,
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
      minVersion: 'TLSv1.2',
      ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
    },
  });
}

async function sendVerificationEmail(user, token) {
  const transport = createTransport();
  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  if (!transport) {
    logger.info('verify_email_skipped_no_smtp', { userId: user._id, verifyUrl });
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: '✉️ Verify your WriteGen AI account',
      text: `Hi ${user.name},\n\nVerify your email within 24 hours:\n${verifyUrl}\n\n— WriteGen AI`,
      html: `<p>Hi <strong>${user.name}</strong>,</p>
<p><a href="${verifyUrl}">Click here to verify your email</a> (link expires in 24 hours).</p>
<p>— WriteGen AI</p>`,
    });
    logger.info('verify_email_sent', { userId: user._id });
  } catch (err) {
    logger.warn('verify_email_failed', { userId: user._id, error: err.message });
  }
}

/**
 * Sends a one-time 80% credit warning email.
 * Silently skips if SMTP is not configured.
 */
async function sendCreditWarningEmail(user, creditsUsed, dailyLimit) {
  const transport = createTransport();
  if (!transport) return;

  const remaining = dailyLimit - creditsUsed;
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: '⚡ You\'ve used 80% of your daily credits — WriteGen AI',
      text: `Hi ${user.name},\n\nYou've used ${creditsUsed} of your ${dailyLimit} daily credits (${remaining} remaining).\n\nUpgrade to Premium for 100 credits/day at ${frontendUrl}/pricing\n\n— WriteGen AI`,
      html: `<p>Hi <strong>${user.name}</strong>,</p>
<p>You've used <strong>${creditsUsed} of ${dailyLimit}</strong> daily credits (<strong>${remaining} remaining</strong>).</p>
<p><a href="${frontendUrl}/pricing">Upgrade to Premium</a> for 100 credits/day.</p>
<p>— WriteGen AI</p>`,
    });
    logger.info('credit_warning_email_sent', { userId: user._id, creditsUsed, dailyLimit });
  } catch (err) {
    logger.warn('credit_warning_email_failed', { userId: user._id, error: err.message });
  }
}

/**
 * Returns true if the user just crossed the 80% threshold with this generation.
 */
function crossedWarningThreshold(creditsUsedBefore, creditsUsedAfter, dailyLimit) {
  const thresholdAt = Math.ceil(dailyLimit * THRESHOLD);
  return creditsUsedBefore < thresholdAt && creditsUsedAfter >= thresholdAt;
}

async function sendPasswordResetEmail(user, token) {
  const transport = createTransport();
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  if (!transport) {
    logger.info('password_reset_email_skipped_no_smtp', { userId: user._id, resetUrl });
    return;
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: '🔑 Reset your WriteGen AI password',
      text: `Hi ${user.name},\n\nReset your password (link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— WriteGen AI`,
      html: `<p>Hi <strong>${user.name}</strong>,</p>
<p><a href="${resetUrl}">Click here to reset your password</a> (link expires in 1 hour).</p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>— WriteGen AI</p>`,
    });
    logger.info('password_reset_email_sent', { userId: user._id });
  } catch (err) {
    logger.warn('password_reset_email_failed', { userId: user._id, error: err.message });
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendCreditWarningEmail, crossedWarningThreshold };
