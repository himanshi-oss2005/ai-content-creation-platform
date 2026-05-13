const Groq     = require('groq-sdk');
const config   = require('../utils/config');
const metrics  = require('../utils/metrics');
const analytics = require('./analytics.service');
const { generateFallbackContent } = require('./fallback.service');
const logger   = require('../utils/logger');

// ─── Groq client ──────────────────────────────────────────────────────────────

let openai;
if (!config.features.mockAI && !config.features.fallbackOnly && process.env.GROQ_API_KEY) {
  openai = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// ─── In-memory LRU cache ──────────────────────────────────────────────────────

const memCache = new Map();

function cacheGet(key) {
  if (!config.features.caching) return null;
  const hit = memCache.get(key);
  if (!hit) return null;
  memCache.delete(key);
  memCache.set(key, hit); // move to end (LRU)
  return hit.output;
}

function cacheSet(key, output) {
  if (!config.features.caching) return;
  if (memCache.size >= config.cache.maxEntries) {
    memCache.delete(memCache.keys().next().value);
  }
  memCache.set(key, { output, ts: Date.now() });
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS = {
  professional: 'Write in a professional, authoritative, and polished tone.',
  casual:       'Write in a friendly, conversational, and approachable tone.',
  marketing:    'Write in a persuasive, energetic, and sales-focused tone with strong CTAs.',
  funny:        'Write in a humorous, witty, and entertaining tone with light jokes.',
  formal:       'Write in a formal, structured, and academic tone.',
};

const TYPE_INSTRUCTIONS = {
  blog:                'Write a detailed, engaging blog post with clear headings and sections.',
  ad:                  'Write compelling advertisement copy with a strong call-to-action.',
  caption:             'Write an engaging social media caption with relevant hashtags.',
  product_description: 'Write a persuasive product description highlighting features and benefits.',
  email:               'Write a professional email with subject line and proper structure.',
  tagline:             'Write 5 creative tagline options for the given topic.',
};

const LENGTH_INSTRUCTIONS = {
  short:  'Keep the output concise — around 100–150 words.',
  medium: 'Aim for a moderate length — around 250–350 words.',
  long:   'Write a comprehensive, detailed piece — around 500–700 words.',
};

function buildPrompt({ type, tone, length = 'medium', language = 'English', keywords = [], prompt, wordCount }) {
  const lengthInstruction = wordCount
    ? `Write the output to be approximately ${wordCount} words.`
    : LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium;
  const keywordClause  = keywords.length ? ` Naturally incorporate these keywords: ${keywords.join(', ')}.` : '';
  const languageClause = language?.toLowerCase() !== 'english' ? ` Write the entire output in ${language}.` : '';

  const system = [
    'You are an expert content writer.',
    TONE_INSTRUCTIONS[tone]     || TONE_INSTRUCTIONS.professional,
    TYPE_INSTRUCTIONS[type]     || TYPE_INSTRUCTIONS.blog,
    lengthInstruction,
    keywordClause,
    languageClause,
  ].filter(Boolean).join(' ');

  return { system, user: prompt };
}

// ─── Mock responses (USE_MOCK_AI compatibility) ───────────────────────────────

const MOCK = {
  blog: (p) => `# ${p}\n\nIn today's fast-paced world, ${p.toLowerCase()} has become increasingly important.\n\n## Why It Matters\n\nUnderstanding this topic can transform how you approach challenges. With the right mindset and tools, success is within reach.\n\n## Key Takeaways\n\n- Start with a clear strategy\n- Measure your progress consistently\n- Adapt and iterate based on results\n\n## Conclusion\n\nBy implementing these insights, you'll be well-positioned to achieve your goals.`,
  ad: (p) => `🚀 Introducing ${p}!\n\nTired of the same old solutions? We've got something different.\n\n✅ Proven results\n✅ Easy to use\n✅ Trusted by thousands\n\n👉 Try it FREE today — Limited time offer!\n\n"This changed everything for us." — Happy Customer\n\nDon't wait. Your success story starts NOW.`,
  caption: (p) => `✨ ${p} — because life's too short for ordinary moments. 🌟\n\nEvery day is a new opportunity to create something amazing. Embrace the journey, celebrate the wins, and keep pushing forward. 💪\n\n#${p.replace(/\s+/g, '')} #Inspiration #Goals #Success #Motivation`,
  product_description: (p) => `**${p}** — Premium Quality, Exceptional Value\n\nExperience the difference with our carefully crafted ${p.toLowerCase()}. Designed for those who demand the best.\n\n**Features:**\n• Superior quality materials\n• Ergonomic design for maximum comfort\n• Built to last with a lifetime guarantee\n• Eco-friendly and sustainably sourced\n\nOrder today and discover why thousands of customers rate us 5 stars.`,
  email: (p) => `Subject: ${p}\n\nDear [Name],\n\nI hope this message finds you well. I'm reaching out regarding ${p.toLowerCase()}.\n\nWe've been working on something exciting that I believe will be of great value to you.\n\nI'd love to schedule a brief call to discuss this further. Would you be available this week?\n\nBest regards,\n[Your Name]`,
  tagline: (p) => `"${p} — Where Innovation Meets Excellence"\n\nAlternatives:\n• "${p}: Redefining What's Possible"\n• "The Future of ${p} Starts Here"\n• "${p} — Built for Champions"\n• "Elevate Your ${p} Experience"`,
};

// ─── OpenAI call with timeout ─────────────────────────────────────────────────

async function callOpenAI(params) {
  const { length = 'medium', wordCount } = params;
  const { system, user } = buildPrompt(params);
  // If exact word count requested, estimate tokens (~1.35 tokens/word) with headroom
  const maxTokens = wordCount
    ? Math.min(Math.ceil(wordCount * 1.5), 4000)
    : config.ai.maxTokens[length] || config.ai.maxTokens.medium;

  const aiPromise = openai.chat.completions.create({
    model:       config.ai.model,
    messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens:  maxTokens,
    temperature: 0.75,
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('OpenAI request timed out')), config.ai.timeoutMs)
  );

  const completion = await Promise.race([aiPromise, timeoutPromise]);
  return {
    output:     completion.choices[0].message.content,
    tokensUsed: completion.usage?.total_tokens ?? null,
  };
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function callOpenAIWithRetry(params) {
  let lastErr;
  for (let attempt = 0; attempt <= config.ai.maxRetries; attempt++) {
    try {
      return await callOpenAI(params);
    } catch (err) {
      lastErr = err;
      const isTimeout = err.message.includes('timed out');
      // Don't retry on timeout — it will just block again
      if (isTimeout || attempt === config.ai.maxRetries) break;

      const delay = config.ai.retryDelayMs * Math.pow(2, attempt); // 800ms, 1600ms
      logger.warn('ai_retry', { attempt: attempt + 1, reason: err.message, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate content — hybrid AI system.
 * Flow: mock → fallback-only → OpenAI (with retry) → fallback on failure
 * Returns: { output, fromCache, source, generationTime, tokensUsed }
 */
const generateContent = async (params) => {
  const { type, prompt, language = 'English', keywords = [] } = params;
  const startTime = Date.now();

  // ── Mock mode ────────────────────────────────────────────────────────────────
  if (config.features.mockAI) {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    const mockFn = MOCK[type] || MOCK.blog;
    let output = mockFn(prompt);
    if (keywords.length) output += `\n\n[Keywords used: ${keywords.join(', ')}]`;
    if (language?.toLowerCase() !== 'english') output += `\n[Language: ${language}]`;
    const genTime = Date.now() - startTime;
    analytics.recordGeneration('MOCK', genTime, type);
    return { output, fromCache: false, source: 'MOCK', generationTime: genTime, tokensUsed: null };
  }

  // ── Fallback-only mode ───────────────────────────────────────────────────────
  if (config.features.fallbackOnly || !openai) {
    if (config.features.fallbackOnly) logger.info('fallback_only_mode', { type });
    if (!openai) logger.warn('groq_client_missing', { hint: 'Set GROQ_API_KEY in .env' });
    const { output } = generateFallbackContent(params);
    const genTime = Date.now() - startTime;
    analytics.recordGeneration('FALLBACK', genTime, type);
    metrics.recordFallback();
    return { output, fromCache: false, source: 'FALLBACK', generationTime: genTime, tokensUsed: null };
  }

  // ── Primary: OpenAI with retry ───────────────────────────────────────────────
  try {
    const { output, tokensUsed } = await callOpenAIWithRetry(params);
    const genTime = Date.now() - startTime;
    analytics.recordGeneration('AI', genTime, type);
    metrics.recordAISuccess();
    logger.info('ai_success', { type, genTime, tokensUsed });
    return { output, fromCache: false, source: 'AI', generationTime: genTime, tokensUsed };
  } catch (err) {
    // All retries exhausted — fall back to local generator
    const isTimeout = err.message.includes('timed out');
    analytics.recordFallbackTrigger(err.message, type, isTimeout);
    metrics.recordFallback();
    logger.warn('ai_fallback_triggered', { reason: err.message, type, isTimeout, retries: config.ai.maxRetries });

    if (!config.features.fallback) {
      // Fallback feature is disabled — surface the error to the caller
      throw err;
    }

    const { output } = generateFallbackContent(params);
    const genTime = Date.now() - startTime;
    analytics.recordGeneration('FALLBACK', genTime, type);
    return { output, fromCache: false, source: 'FALLBACK', generationTime: genTime, tokensUsed: null };
  }
};

module.exports = { generateContent, cacheGet, cacheSet };
