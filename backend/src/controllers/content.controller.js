const crypto     = require('crypto');
const mongoose   = require('mongoose');
const AdmZip     = require('adm-zip');
const PDFDocument = require('pdfkit');
const Content    = require('../models/Content');
const Transaction = require('../models/Transaction');
const User       = require('../models/User');
const { generateContent, cacheGet, cacheSet } = require('../services/ai.service');
const { sendCreditWarningEmail, crossedWarningThreshold } = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');
const AppError   = require('../utils/AppError');
const logger     = require('../utils/logger');

// ─── Single generation ────────────────────────────────────────────────────────

exports.generate = asyncHandler(async (req, res) => {
  const {
    type, tone, prompt,
    length    = 'medium',
    language  = 'English',
    keywords  = [],
    wordCount,
  } = req.body;

  const user = await User.findById(req.user._id);
  const wasReset = user.resetDailyCreditsIfNeeded();
  if (wasReset) await user.save();

  if (!user.canGenerate()) {
    logger.warn('credits_exhausted', { userId: user._id, role: user.role });
    throw new AppError(
      `Daily limit of ${user.getDailyLimit()} credits reached. Upgrade to Premium for more.`,
      429
    );
  }

  // Cache lookup — tier 1: memory, tier 2: DB
  const cacheKey = Content.buildCacheKey(type, tone, length, language, prompt, keywords, wordCount);
  if (typeof cacheKey !== 'string') throw new AppError('Invalid cache key', 400);
  let output    = cacheGet(cacheKey);
  let fromCache = !!output;

  if (!fromCache) {
    const cached = await Content.findOne({ cacheKey: { $eq: String(cacheKey) } }).select('output').lean();
    if (cached) {
      output    = cached.output;
      fromCache = true;
      cacheSet(cacheKey, output);
    }
  }

  let source = 'AI', generationTime = 0, tokensUsed = null;

  if (!fromCache) {
    const result   = await generateContent({ type, tone, prompt, length, language, keywords, wordCount });
    output         = result.output;
    source         = result.source;
    generationTime = result.generationTime;
    tokensUsed     = result.tokensUsed;
    cacheSet(cacheKey, output);
  }

  const creditsBefore  = user.creditsUsedToday;
  const newCreditsUsed = creditsBefore + 1;
  const dailyLimit     = user.getDailyLimit();
  const warned         = crossedWarningThreshold(creditsBefore, newCreditsUsed, dailyLimit);

  const [content] = await Promise.all([
    Content.create({
      user: user._id, type, tone, prompt, output,
      length, language, keywords, cacheKey,
      source, generationTime, tokensUsed,
      ...(wordCount && { targetWordCount: wordCount }),
    }),
    User.findByIdAndUpdate(user._id, { $inc: { creditsUsedToday: 1, totalGenerations: 1 } }),
    Transaction.create({
      user: user._id, type: 'usage', amount: -1,
      description: `Generated ${type} content`,
    }),
  ]);

  if (warned) sendCreditWarningEmail(user, newCreditsUsed, dailyLimit);

  logger.credit(user._id, type, dailyLimit - newCreditsUsed);

  res.status(201).json({
    content,
    fromCache,
    source:           fromCache ? 'CACHE' : source,
    generationTime:   fromCache ? 0 : generationTime,
    tokensUsed:       fromCache ? null : tokensUsed,
    creditsUsedToday: newCreditsUsed,
    creditsRemaining: dailyLimit - newCreditsUsed,
    creditWarning:    warned,
  });
});

// ─── A/B generation ───────────────────────────────────────────────────────────

exports.generateAB = asyncHandler(async (req, res) => {
  const {
    type, tone, prompt,
    length   = 'medium',
    language = 'English',
    keywords = [],
  } = req.body;

  const user = await User.findById(req.user._id);
  const wasReset = user.resetDailyCreditsIfNeeded();
  if (wasReset) await user.save();

  if (user.creditsUsedToday + 2 > user.getDailyLimit()) {
    throw new AppError('Not enough credits for A/B generation (requires 2 credits).', 429);
  }

  const [resultA, resultB] = await Promise.all([
    generateContent({ type, tone, prompt, length, language, keywords }),
    generateContent({ type, tone, prompt, length, language, keywords }),
  ]);

  const creditsBefore  = user.creditsUsedToday;
  const newCreditsUsed = creditsBefore + 2;
  const dailyLimit     = user.getDailyLimit();
  const warned         = crossedWarningThreshold(creditsBefore, newCreditsUsed, dailyLimit);

  const [contentA, contentB] = await Promise.all([
    Content.create({ user: user._id, type, tone, prompt, output: resultA.output, length, language, keywords, source: resultA.source, generationTime: resultA.generationTime, tokensUsed: resultA.tokensUsed }),
    Content.create({ user: user._id, type, tone, prompt, output: resultB.output, length, language, keywords, source: resultB.source, generationTime: resultB.generationTime, tokensUsed: resultB.tokensUsed }),
    User.findByIdAndUpdate(user._id, { $inc: { creditsUsedToday: 2, totalGenerations: 2 } }),
  ]);

  if (warned) sendCreditWarningEmail(user, newCreditsUsed, dailyLimit);

  logger.info('ab_generated', { userId: user._id, type });

  res.status(201).json({
    variantA: contentA,
    variantB: contentB,
    creditsUsedToday: newCreditsUsed,
    creditsRemaining: dailyLimit - newCreditsUsed,
    creditWarning:    warned,
  });
});

// ─── Tone comparison generation ──────────────────────────────────────────────

exports.generateToneComparison = asyncHandler(async (req, res) => {
  const {
    type, tones, prompt,
    length   = 'medium',
    language = 'English',
    keywords = [],
    wordCount,
  } = req.body;

  const user = await User.findById(req.user._id);
  const wasReset = user.resetDailyCreditsIfNeeded();
  if (wasReset) await user.save();

  const creditsNeeded = tones.length;
  if (user.creditsUsedToday + creditsNeeded > user.getDailyLimit()) {
    throw new AppError(`Not enough credits for tone comparison (requires ${creditsNeeded} credits).`, 429);
  }

  const results = await Promise.all(
    tones.map((tone) => generateContent({ type, tone, prompt, length, language, keywords, wordCount }))
  );

  const newCreditsUsed = user.creditsUsedToday + creditsNeeded;

  const savedContents = await Promise.all(
    results.map((result, i) =>
      Content.create({
        user: user._id, type, tone: tones[i], prompt, output: result.output,
        length, language, keywords,
        source: result.source, generationTime: result.generationTime, tokensUsed: result.tokensUsed,
        ...(wordCount && { targetWordCount: wordCount }),
      })
    )
  );

  await Promise.all([
    User.findByIdAndUpdate(user._id, { $inc: { creditsUsedToday: creditsNeeded, totalGenerations: creditsNeeded } }),
    ...tones.map((tone) => Transaction.create({
      user: user._id, type: 'usage', amount: -1,
      description: `Generated ${type} content (tone comparison: ${tone})`,
    })),
  ]);

  logger.info('tone_comparison_generated', { userId: user._id, type, tones });

  res.status(201).json({
    variants: savedContents.map((content, i) => ({ ...content.toObject(), tone: tones[i] })),
    creditsUsedToday: newCreditsUsed,
    creditsRemaining: user.getDailyLimit() - newCreditsUsed,
  });
});

exports.selectABVariant = asyncHandler(async (req, res) => {
  const { selectedId, rejectedId } = req.body;
  if (!selectedId || !rejectedId) throw new AppError('selectedId and rejectedId are required', 400);
  if (!mongoose.Types.ObjectId.isValid(selectedId)) throw new AppError('Invalid selectedId', 400);
  if (!mongoose.Types.ObjectId.isValid(rejectedId)) throw new AppError('Invalid rejectedId', 400);

  const safeSelectedId = new mongoose.Types.ObjectId(String(selectedId));
  const safeRejectedId = new mongoose.Types.ObjectId(String(rejectedId));
  const userId         = new mongoose.Types.ObjectId(String(req.user._id));

  const [selected] = await Promise.all([
    Content.findOneAndUpdate(
      { _id: safeSelectedId, user: userId },
      { isFavorite: true },
      { new: true }
    ),
    Content.findOneAndDelete({ _id: safeRejectedId, user: userId }),
  ]);

  if (!selected) throw new AppError('Selected content not found', 404);
  res.json({ selected });
});

// ─── History ──────────────────────────────────────────────────────────────────

exports.getHistory = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 10,
    type, search, favorites,
    dateFrom, dateTo,
    collection,          // MongoId | 'none' (uncollected) | undefined (all)
  } = req.query;

  const filter = { user: new mongoose.Types.ObjectId(String(req.user._id)) };

  const VALID_TYPES = ['blog', 'ad', 'caption', 'product_description', 'email', 'tagline'];
  if (type && !VALID_TYPES.includes(type)) throw new AppError('Invalid content type', 400);
  if (type) filter.type = type;
  if (favorites === 'true') filter.isFavorite = true;

  // collection filter: 'none' = items with no collection, ObjectId = specific folder
  if (collection === 'none') {
    filter.collectionId = null;
  } else if (collection) {
    if (!mongoose.Types.ObjectId.isValid(collection)) throw new AppError('Invalid collection ID', 400);
    filter.collectionId = new mongoose.Types.ObjectId(collection);
  }

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) {
      if (typeof dateFrom !== 'string' || isNaN(Date.parse(dateFrom))) throw new AppError('Invalid dateFrom', 400);
      filter.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      if (typeof dateTo !== 'string' || isNaN(Date.parse(dateTo))) throw new AppError('Invalid dateTo', 400);
      filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }
  }

  if (search) {
    if (typeof search !== 'string') throw new AppError('Invalid search parameter', 400);
    if (search.length > 100) throw new AppError('Search term too long (max 100 characters)', 400);
    const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { prompt:   { $regex: String(escapedSearch), $options: 'i' } },
      { output:   { $regex: String(escapedSearch), $options: 'i' } },
      { keywords: { $regex: String(escapedSearch), $options: 'i' } },
    ];
  }

  const pageNum  = Math.max(1, parseInt(String(page),  10));
  const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10)));

  const [items, total] = await Promise.all([
    Content.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Content.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) || 1 });
});

// ─── Update (inline edit) ───────────────────────────────────────────────────

exports.updateContent = asyncHandler(async (req, res) => {
  const { output } = req.body;
  if (!output || typeof output !== 'string' || output.trim().length === 0) {
    throw new AppError('output is required', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid content ID', 400);

  const content = await Content.findOne({
    _id: new mongoose.Types.ObjectId(String(req.params.id)),
    user: new mongoose.Types.ObjectId(String(req.user._id)),
  });
  if (!content) throw new AppError('Content not found', 404);

  content.output = output.trim();
  await content.save();
  res.json({ content });
});

// ─── Regenerate with tweaks ───────────────────────────────────────────────────

exports.regenerate = asyncHandler(async (req, res) => {
  const {
    contentId,
    tone,
    length,
    keywords,
  } = req.body;

  if (!contentId) throw new AppError('contentId is required', 400);
  if (!mongoose.Types.ObjectId.isValid(contentId)) throw new AppError('Invalid contentId', 400);

  const safeContentId = new mongoose.Types.ObjectId(String(contentId));
  const userId        = new mongoose.Types.ObjectId(String(req.user._id));

  // Load the original content to reuse its prompt/type
  const original = await Content.findOne({ _id: safeContentId, user: userId }).lean();
  if (!original) throw new AppError('Original content not found', 404);

  const user = await User.findById(req.user._id);
  const wasReset = user.resetDailyCreditsIfNeeded();
  if (wasReset) await user.save();

  if (!user.canGenerate()) {
    throw new AppError(
      `Daily limit of ${user.getDailyLimit()} credits reached. Upgrade to Premium for more.`,
      429
    );
  }

  // Merge overrides — fall back to original values for anything not supplied
  const params = {
    type:     original.type,
    prompt:   original.prompt,
    tone:     tone     ?? original.tone,
    length:   length   ?? original.length,
    keywords: keywords ?? original.keywords,
    language: original.language,
  };

  const result = await generateContent(params);
  const creditsBefore  = user.creditsUsedToday;
  const newCreditsUsed = creditsBefore + 1;
  const dailyLimit     = user.getDailyLimit();
  const warned         = crossedWarningThreshold(creditsBefore, newCreditsUsed, dailyLimit);

  const [content] = await Promise.all([
    Content.create({
      user:           user._id,
      type:           params.type,
      tone:           params.tone,
      prompt:         params.prompt,
      output:         result.output,
      length:         params.length,
      language:       params.language,
      keywords:       params.keywords,
      source:         result.source,
      generationTime: result.generationTime,
      tokensUsed:     result.tokensUsed,
    }),
    User.findByIdAndUpdate(user._id, { $inc: { creditsUsedToday: 1, totalGenerations: 1 } }),
    Transaction.create({
      user: user._id, type: 'usage', amount: -1,
      description: `Regenerated ${params.type} content`,
    }),
  ]);

  if (warned) sendCreditWarningEmail(user, newCreditsUsed, dailyLimit);

  logger.credit(user._id, params.type, dailyLimit - newCreditsUsed);

  res.status(201).json({
    content,
    source:           result.source,
    generationTime:   result.generationTime,
    tokensUsed:       result.tokensUsed,
    creditsUsedToday: newCreditsUsed,
    creditsRemaining: dailyLimit - newCreditsUsed,
    creditWarning:    warned,
  });
});

// ─── Delete / Favorite ────────────────────────────────────────────────────────

exports.deleteContent = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid content ID', 400);
  const content = await Content.findOneAndDelete({
    _id: new mongoose.Types.ObjectId(String(req.params.id)),
    user: new mongoose.Types.ObjectId(String(req.user._id)),
  });
  if (!content) throw new AppError('Content not found', 404);
  res.json({ message: 'Deleted successfully' });
});

// ─── Bulk Export ─────────────────────────────────────────────────────────────

exports.bulkExport = asyncHandler(async (req, res) => {
  const { ids, format } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) throw new AppError('ids must be a non-empty array', 400);

  const validIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) throw new AppError('No valid IDs provided', 400);

  const items = await Content.find({ _id: { $in: validIds }, user: new mongoose.Types.ObjectId(String(req.user._id)) })
    .select('type tone prompt output wordCount createdAt')
    .lean();

  if (!items.length) throw new AppError('No content found for the given IDs', 404);

  if (format === 'zip') {
    const zip = new AdmZip();

    items.forEach((item, i) => {
      const date = new Date(item.createdAt).toISOString().slice(0, 10);
      const text = `Type: ${item.type}\nTone: ${item.tone}\nDate: ${date}\nWords: ${item.wordCount ?? 0}\n\nPrompt:\n${item.prompt}\n\nContent:\n${item.output}`;
      zip.addFile(`${i + 1}-${item.type}-${date}.txt`, Buffer.from(text, 'utf8'));
    });

    const buffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="writegen-export.zip"');
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
    return;
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="writegen-export.pdf"');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    items.forEach((item, i) => {
      if (i > 0) doc.addPage();
      const date = new Date(item.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      doc.fontSize(18).fillColor('#0284c7').text(`WriteGen AI — ${item.type.replace(/_/g, ' ').toUpperCase()}`, { underline: false });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#555555').text(`Tone: ${item.tone}   |   Words: ${item.wordCount ?? 0}   |   Generated: ${date}`);
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#374151').text('Prompt:', { continued: false });
      doc.fontSize(11).fillColor('#1a1a1a').text(item.prompt, { indent: 10 });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#374151').text('Content:', { continued: false });
      doc.fontSize(11).fillColor('#1a1a1a').text(item.output, { indent: 10, lineGap: 3 });
    });

    doc.end();
    return;
  }

  throw new AppError('format must be zip or pdf', 400);
});

exports.toggleFavorite = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid content ID', 400);
  const content = await Content.findOne({
    _id: new mongoose.Types.ObjectId(String(req.params.id)),
    user: new mongoose.Types.ObjectId(String(req.user._id)),
  });
  if (!content) throw new AppError('Content not found', 404);
  content.isFavorite = !content.isFavorite;
  await content.save();
  res.json({ isFavorite: content.isFavorite });
});

exports.toggleShare = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid content ID', 400);
  const content = await Content.findOne({
    _id: new mongoose.Types.ObjectId(String(req.params.id)),
    user: new mongoose.Types.ObjectId(String(req.user._id)),
  });
  if (!content) throw new AppError('Content not found', 404);

  content.isPublic = !content.isPublic;
  if (content.isPublic && !content.shareToken) {
    content.shareToken = crypto.randomBytes(20).toString('hex');
  }
  await content.save();
  res.json({ isPublic: content.isPublic, shareToken: content.shareToken });
});

exports.getSharedContent = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string' || !/^[a-fA-F0-9]{40}$/.test(token)) {
    throw new AppError('Invalid share token', 400);
  }

  const content = await Content.findOne({ shareToken: token, isPublic: true })
    .select('type tone prompt output wordCount createdAt')
    .lean();
  if (!content) throw new AppError('Shared content not found or no longer public', 404);
  res.json({ content });
});

// ─── Dashboard stats ──────────────────────────────────────────────────────────

exports.getStats = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.user._id)) throw new AppError('Invalid user ID', 400);
  const userId = new mongoose.Types.ObjectId(String(req.user._id));

  const wasReset = req.user.resetDailyCreditsIfNeeded();
  if (wasReset) await req.user.save();

  const [totalContent, byType, recentActivity, weeklyUsage, dailyCreditsUsed] = await Promise.all([
    Content.countDocuments({ user: userId }),

    Content.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Content.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type prompt createdAt')
      .lean(),

    Content.aggregate([
      {
        $match: {
          user: userId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(String(userId.toHexString())),
          type: 'usage',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    totalContent,
    byType,
    mostUsedType:     byType[0]?._id ?? null,
    recentActivity,
    weeklyUsage,
    dailyCreditsUsed,
    creditsUsedToday: req.user.creditsUsedToday,
    dailyLimit:       req.user.getDailyLimit(),
    totalGenerations: req.user.totalGenerations,
    role:             req.user.role,
  });
});
