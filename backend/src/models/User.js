const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 80 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, minlength: 6, maxlength: 128, select: false },
  googleId: { type: String, select: false },
  githubId: { type: String, select: false },
  role:     { type: String, enum: ['free', 'premium', 'admin'], default: 'free' },
  credits:          { type: Number, default: 10 },
  creditsUsedToday: { type: Number, default: 0 },
  lastCreditReset:  { type: Date, default: Date.now },
  totalGenerations: { type: Number, default: 0 },
  stripeCustomerId:     { type: String, select: false },
  stripeSubscriptionId: { type: String, select: false },
  subscriptionStatus:   { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'inactive' },
  promptHistory:            { type: [String], default: [] },
  isEmailVerified:          { type: Boolean, default: false },
  oauthProvider:            { type: String },
  emailVerificationToken:   { type: String, select: false },
  emailVerificationExpires: { type: Date,   select: false },
  passwordResetToken:       { type: String, select: false },
  passwordResetExpires:     { type: Date,   select: false },
  // Rate-limit forgot-password to 3 requests per hour
  passwordResetRequestCount: { type: Number, default: 0 },
  passwordResetWindowStart:  { type: Date,   default: null, select: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.resetDailyCreditsIfNeeded = function () {
  const now  = new Date();
  const last = new Date(this.lastCreditReset);
  if (now.toDateString() !== last.toDateString()) {
    this.creditsUsedToday = 0;
    this.lastCreditReset  = now;
    return true;
  }
  return false;
};

userSchema.methods.getDailyLimit = function () {
  return this.role === 'premium'
    ? parseInt(process.env.PREMIUM_DAILY_CREDITS, 10) || 100
    : parseInt(process.env.FREE_DAILY_CREDITS,    10) || 10;
};

userSchema.methods.canGenerate = function () {
  return this.creditsUsedToday < this.getDailyLimit();
};

// Strip all sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.googleId;
  delete obj.githubId;
  delete obj.stripeCustomerId;
  delete obj.stripeSubscriptionId;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.passwordResetRequestCount;
  delete obj.passwordResetWindowStart;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
