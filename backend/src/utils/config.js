const crypto = require('crypto');

const REQUIRED_IN_PROD = ['JWT_SECRET', 'MONGO_URI', 'FRONTEND_URL'];

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const jwtSecret          = process.env.JWT_SECRET;
const INSECURE_PLACEHOLDER = 'your_super_secret_jwt_key_change_in_production';

const isSecureJwtSecret  = (secret) => typeof secret === 'string' && secret.length >= 32;
const isPlaceholderSecret = (secret) => {
  const secretString      = String(secret);
  const placeholderBuffer = Buffer.from(INSECURE_PLACEHOLDER);
  const secretBuffer      = Buffer.from(secretString);
  if (secretBuffer.length !== placeholderBuffer.length) return false;
  return crypto.timingSafeEqual(secretBuffer, placeholderBuffer);
};

const normalizeFrontendUrls = () => {
  const raw = process.env.FRONTEND_URL?.trim() || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200');
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FRONTEND_URL must be set in production and use https://');
    }
    return ['http://localhost:4200'];
  }

  const urls = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        const parsed = new URL(value);
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new Error();
        return parsed.origin;
      } catch {
        throw new Error(`Invalid FRONTEND_URL: ${value}. In production FRONTEND_URL must use https://`);
      }
    });

  if (!urls.length) throw new Error('FRONTEND_URL must contain at least one valid URL');
  return urls;
};

let effectiveJwtSecret = jwtSecret;
if (!isSecureJwtSecret(effectiveJwtSecret) || isPlaceholderSecret(effectiveJwtSecret)) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }
  effectiveJwtSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET is missing or insecure. Using a temporary generated secret for local development only.');
}

const frontendUrl = normalizeFrontendUrls();

const config = {
  port:    parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV      || 'development',
  isProd:  process.env.NODE_ENV === 'production',

  mongoUri:   process.env.MONGO_URI || 'mongodb://localhost:27017/writegen_ai',
  jwtSecret:  effectiveJwtSecret,
  jwtExpires: process.env.JWT_EXPIRES_IN || '7d',

  credits: {
    free:    parseInt(process.env.FREE_DAILY_CREDITS)    || 10,
    premium: parseInt(process.env.PREMIUM_DAILY_CREDITS) || 100,
  },

  ai: {
    timeoutMs:    parseInt(process.env.AI_TIMEOUT_MS)  || 15000,
    maxRetries:   parseInt(process.env.AI_MAX_RETRIES) || 2,
    retryDelayMs: 800,
    model:        process.env.OPENAI_MODEL || 'llama-3.3-70b-versatile',
    maxTokens:    { short: 250, medium: 500, long: 900 },
  },

  rateLimit: {
    global:   { windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LIMIT_GLOBAL)   || 100 },
    generate: { windowMs: 60 * 1000,       max: parseInt(process.env.RATE_LIMIT_GENERATE) || 5   },
    auth:     { windowMs: 15 * 60 * 1000, max: parseInt(process.env.RATE_LIMIT_AUTH)     || 20  },
  },

  cache:     { maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES) || 200 },
  analytics: { maxEvents: 2000, slowThresholdMs: parseInt(process.env.SLOW_THRESHOLD_MS) || 3000 },

  features: {
    fallback:     process.env.ENABLE_FALLBACK    !== 'false',
    abTesting:    process.env.ENABLE_AB_TESTING  !== 'false',
    caching:      process.env.ENABLE_CACHING     !== 'false',
    mockAI:       process.env.USE_MOCK_AI        === 'true',
    fallbackOnly: process.env.USE_FALLBACK_ONLY  === 'true',
  },

  frontendUrl:        frontendUrl,
  frontendUrlPrimary: frontendUrl[0],
};

module.exports = config;
