const mongoose = require('mongoose');
const crypto   = require('crypto');

const contentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  type: {
    type: String,
    enum: ['blog', 'ad', 'caption', 'product_description', 'email', 'tagline'],
    required: true,
  },
  tone: {
    type: String,
    enum: ['professional', 'casual', 'marketing', 'funny', 'formal'],
    default: 'professional',
  },
  length: {
    type: String,
    enum: ['short', 'medium', 'long'],
    default: 'medium',
  },
  language: {
    type: String,
    default: 'English',
    trim: true,
  },
  keywords: {
    type: [String],
    default: [],
    validate: {
      validator: (arr) => arr.length <= 10 && arr.every((k) => typeof k === 'string' && k.length <= 50),
      message: 'Keywords must be an array of up to 10 strings, each max 50 chars',
    },
  },

  prompt:   { type: String, required: true },
  output:   { type: String, required: true },

  creditsUsed: { type: Number, default: 1 },
  wordCount:   { type: Number, default: 0 },
  targetWordCount: { type: Number, default: null },
  isFavorite:  { type: Boolean, default: false },

  // Generation metadata
  source:         { type: String, enum: ['AI', 'MOCK', 'FALLBACK'], default: 'AI' },
  generationTime: { type: Number, default: 0 },  // ms
  tokensUsed:     { type: Number, default: null },

  // SHA-256 of (type|tone|length|language|prompt) — used for cache lookups
  cacheKey: { type: String, index: true },

  isPublic:   { type: Boolean, default: false },
  shareToken: { type: String, unique: true, sparse: true, index: true },

  // Optional collection (folder) — null means uncollected. Default null keeps
  // all existing documents backward-compatible without a migration.
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Collection',
    default: null,
    index: true,
  },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.collectionId;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.collectionId;
      return ret;
    },
  },
});

// Auto-calculate word count and cache key before every save
contentSchema.pre('save', function (next) {
  this.wordCount = this.output.split(/\s+/).filter(Boolean).length;
  this.cacheKey  = buildCacheKey(this.type, this.tone, this.length, this.language, this.prompt, this.keywords, this.targetWordCount);
  next();
});

/**
 * Build a deterministic cache key from generation parameters.
 * Exported so the controller can check the cache before calling the AI.
 */
function normalizeKeywordsForCache(keywords) {
  if (!Array.isArray(keywords)) return '';
  return [...new Set(keywords.map((k) => String(k || '').trim()).filter(Boolean))].sort().join(',');
}

function buildCacheKey(type, tone, length, language, prompt, keywords = [], wordCount) {
  const cleanedKeywords = normalizeKeywordsForCache(keywords);
  const raw = `${type}|${tone}|${length}|${(language || 'English').toLowerCase()}|${prompt.trim()}|${cleanedKeywords}|${wordCount || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

contentSchema.virtual('collection')
  .get(function () {
    return this.collectionId;
  })
  .set(function (value) {
    this.collectionId = value;
  });

contentSchema.statics.buildCacheKey = buildCacheKey;

// ── Indexes ───────────────────────────────────────────────────────────────────────────
contentSchema.index({ user: 1, createdAt: -1 }); // history queries

module.exports = mongoose.model('Content', contentSchema);
