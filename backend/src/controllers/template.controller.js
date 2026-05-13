const PromptTemplate = require('../models/PromptTemplate');
const asyncHandler   = require('../utils/asyncHandler');
const AppError       = require('../utils/AppError');

// Predefined system templates seeded on first request
const SYSTEM_TEMPLATES = [
  { name: 'SEO Blog Post',       type: 'blog',                description: 'Optimised blog post structure for search engines', tone: 'professional', length: 'long',   prompt: 'Write an SEO-optimised blog post about {topic}. Include a compelling title, meta description, H2 subheadings, and a clear call-to-action.' },
  { name: 'Instagram Ad',        type: 'ad',                  description: 'Short punchy ad copy for Instagram',               tone: 'marketing',    length: 'short',  prompt: 'Create a high-converting Instagram ad for {product}. Use emojis, a strong hook, 3 bullet benefits, and a clear CTA.' },
  { name: 'Cold Email Pitch',    type: 'email',               description: 'B2B cold outreach email template',                 tone: 'professional', length: 'short',  prompt: 'Write a cold outreach email to a potential B2B client about {service}. Keep it under 150 words, personalised, and end with a soft CTA.' },
  { name: 'Product Launch',      type: 'product_description', description: 'Launch-ready product description',                 tone: 'marketing',    length: 'medium', prompt: 'Write a product launch description for {product}. Highlight the problem it solves, key features, and why it\'s better than alternatives.' },
  { name: 'Viral Caption',       type: 'caption',             description: 'Engagement-optimised social caption',              tone: 'casual',       length: 'short',  prompt: 'Write a viral-worthy Instagram caption for a post about {topic}. Include a question to drive comments and 5 relevant hashtags.' },
  { name: 'Brand Taglines',      type: 'tagline',             description: '5 creative tagline options for a brand',           tone: 'marketing',    length: 'short',  prompt: 'Generate 5 creative tagline options for a brand focused on {topic}. Make each one memorable, distinct, and under 10 words.' },
  { name: 'Thought Leadership',  type: 'blog',                description: 'Executive thought leadership article',             tone: 'formal',       length: 'long',   prompt: 'Write a thought leadership article on {topic} from the perspective of an industry executive. Include data points, trends, and a forward-looking conclusion.' },
  { name: 'Funny Product Ad',    type: 'ad',                  description: 'Humorous ad copy that converts',                   tone: 'funny',        length: 'medium', prompt: 'Write a funny, self-aware ad for {product} that uses humour to highlight its benefits. Include a witty headline and a memorable CTA.' },
];

async function ensureSystemTemplates() {
  const count = await PromptTemplate.countDocuments({ isSystem: true });
  if (count === 0) {
    await PromptTemplate.insertMany(
      SYSTEM_TEMPLATES.map((t) => ({ ...t, isSystem: true }))
    );
  }
}

// GET /api/templates — list system templates + user's own templates
exports.listTemplates = asyncHandler(async (req, res) => {
  await ensureSystemTemplates();

  const [system, userTemplates] = await Promise.all([
    PromptTemplate.find({ isSystem: true }).sort({ type: 1, name: 1 }).lean(),
    PromptTemplate.find({ user: req.user._id, isSystem: false }).sort({ createdAt: -1 }).lean(),
  ]);

  res.json({ system, custom: userTemplates });
});

// POST /api/templates — save a new custom template
exports.createTemplate = asyncHandler(async (req, res) => {
  const { name, description, type, tone, length, language, keywords, prompt } = req.body;

  const template = await PromptTemplate.create({
    user: req.user._id,
    name, description, type, tone, length, language, keywords, prompt,
    versions: [{ prompt, note: 'Initial version' }],
  });

  res.status(201).json({ template });
});

// PATCH /api/templates/:id — edit a custom template (saves version history)
exports.updateTemplate = asyncHandler(async (req, res) => {
  const template = await PromptTemplate.findOne({ _id: req.params.id, user: req.user._id });
  if (!template) throw new AppError('Template not found', 404);

  const sanitize = (value) => (typeof value === 'string' ? value.trim() : value);
  const name        = sanitize(req.body.name);
  const description = sanitize(req.body.description);
  const tone        = sanitize(req.body.tone);
  const length      = sanitize(req.body.length);
  const language    = sanitize(req.body.language);
  const prompt      = sanitize(req.body.prompt);
  const keywords    = Array.isArray(req.body.keywords) ? req.body.keywords.map((k) => String(k).trim()) : undefined;
  const versionNote = sanitize(req.body.versionNote);

  if (prompt && prompt !== template.prompt) {
    template.versions.push({ prompt: template.prompt, note: versionNote || 'Previous version' });
  }

  if (name)        template.name        = name;
  if (description) template.description = description;
  if (tone)        template.tone        = tone;
  if (length)      template.length      = length;
  if (language)    template.language    = language;
  if (keywords)    template.keywords    = keywords;
  if (prompt)      template.prompt      = prompt;

  await template.save();
  res.json({ template });
});

// DELETE /api/templates/:id
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await PromptTemplate.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!template) throw new AppError('Template not found', 404);
  res.json({ message: 'Template deleted' });
});

// POST /api/templates/:id/use — increment usage counter
exports.useTemplate = asyncHandler(async (req, res) => {
  const template = await PromptTemplate.findOneAndUpdate(
    { _id: req.params.id, $or: [{ user: req.user._id }, { isSystem: true }] },
    { $inc: { usageCount: 1 } },
    { new: true }
  ).lean();
  if (!template) throw new AppError('Template not found', 404);
  res.json({ template });
});
