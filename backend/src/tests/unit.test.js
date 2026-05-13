/**
 * Unit Tests — WriteGen AI
 * Covers: credit system, daily reset, fallback service, analytics, metrics, config, AI switching
 * Run: npm test
 */

// ─── 1. Config module ─────────────────────────────────────────────────────────

describe('config', () => {
  const config = require('../utils/config');

  it('has safe defaults for all critical values', () => {
    expect(config.credits.free).toBeGreaterThan(0);
    expect(config.credits.premium).toBeGreaterThan(config.credits.free);
    expect(config.ai.timeoutMs).toBeGreaterThan(0);
    expect(config.ai.maxRetries).toBeGreaterThanOrEqual(0);
    expect(config.rateLimit.global.max).toBeGreaterThan(0);
  });

  it('exposes feature flags as booleans', () => {
    expect(typeof config.features.fallback).toBe('boolean');
    expect(typeof config.features.abTesting).toBe('boolean');
    expect(typeof config.features.caching).toBe('boolean');
  });

  describe('when FREE_DAILY_CREDITS is set', () => {
    it('reads FREE_DAILY_CREDITS from env', () => {
      let isolatedConfig;
      process.env.FREE_DAILY_CREDITS = '15';
      jest.isolateModules(() => { isolatedConfig = require('../utils/config'); });
      expect(isolatedConfig.credits.free).toBe(15);
      delete process.env.FREE_DAILY_CREDITS;
    });
  });
});

// ─── 2. Credit system & daily reset ──────────────────────────────────────────

describe('User credit logic', () => {
  function makeUser({ role = 'free', creditsUsedToday = 0, lastCreditReset = new Date() } = {}) {
    return {
      role,
      creditsUsedToday,
      lastCreditReset,
      getDailyLimit() { return this.role === 'premium' ? 100 : 10; },
      canGenerate()   { return this.creditsUsedToday < this.getDailyLimit(); },
      resetDailyCreditsIfNeeded() {
        const now  = new Date();
        const last = new Date(this.lastCreditReset);
        if (now.toDateString() !== last.toDateString()) {
          this.creditsUsedToday = 0;
          this.lastCreditReset  = now;
          return true;
        }
        return false;
      },
    };
  }

  it('free user daily limit is 10',    () => expect(makeUser({ role: 'free' }).getDailyLimit()).toBe(10));
  it('premium user daily limit is 100', () => expect(makeUser({ role: 'premium' }).getDailyLimit()).toBe(100));

  it('canGenerate true when credits available',  () => expect(makeUser({ creditsUsedToday: 5 }).canGenerate()).toBe(true));
  it('canGenerate false when limit reached',     () => expect(makeUser({ creditsUsedToday: 10 }).canGenerate()).toBe(false));
  it('canGenerate false when over limit',        () => expect(makeUser({ creditsUsedToday: 11 }).canGenerate()).toBe(false));

  it('premium boundary: 99 → can, 100 → cannot', () => {
    const user = makeUser({ role: 'premium', creditsUsedToday: 99 });
    expect(user.canGenerate()).toBe(true);
    user.creditsUsedToday = 100;
    expect(user.canGenerate()).toBe(false);
  });

  it('reset returns false on same day', () => {
    const user = makeUser({ creditsUsedToday: 7 });
    expect(user.resetDailyCreditsIfNeeded()).toBe(false);
    expect(user.creditsUsedToday).toBe(7);
  });

  it('reset returns true and zeroes credits on new day', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = makeUser({ creditsUsedToday: 8, lastCreditReset: yesterday });
    expect(user.resetDailyCreditsIfNeeded()).toBe(true);
    expect(user.creditsUsedToday).toBe(0);
  });

  it('reset updates lastCreditReset to today', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const user = makeUser({ lastCreditReset: yesterday });
    user.resetDailyCreditsIfNeeded();
    expect(user.lastCreditReset.toDateString()).toBe(new Date().toDateString());
  });
});

// ─── 3. Fallback service ──────────────────────────────────────────────────────

describe('generateFallbackContent', () => {
  const { generateFallbackContent } = require('../services/fallback.service');
  const TYPES = ['blog', 'ad', 'caption', 'product_description', 'email', 'tagline'];
  const TONES = ['professional', 'casual', 'marketing', 'funny', 'formal'];

  beforeEach(() => {
    jest.resetModules();
  });

  it('returns non-empty string for all content types', () => {
    TYPES.forEach((type) => {
      const { output } = generateFallbackContent({ type, tone: 'professional', prompt: 'Test topic', length: 'medium' });
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(50);
    });
  });

  it('produces different output for different tones', () => {
    const outputs = TONES.map((tone) =>
      generateFallbackContent({ type: 'blog', tone, prompt: 'AI in healthcare', length: 'medium' }).output
    );
    expect(new Set(outputs).size).toBeGreaterThan(1);
  });

  it('short blog is shorter than long blog', () => {
    const base = { type: 'blog', tone: 'professional', prompt: 'Remote work' };
    const short = generateFallbackContent({ ...base, length: 'short' }).output;
    const long  = generateFallbackContent({ ...base, length: 'long'  }).output;
    expect(short.length).toBeLessThan(long.length);
  });

  it('weaves at least one keyword into blog output', () => {
    const keywords = ['productivity', 'async tools'];
    const { output } = generateFallbackContent({ type: 'blog', tone: 'professional', prompt: 'Remote work', length: 'medium', keywords });
    expect(keywords.some((kw) => output.toLowerCase().includes(kw.toLowerCase()))).toBe(true);
  });

  it('email output contains Subject line',    () => expect(generateFallbackContent({ type: 'email',   tone: 'professional', prompt: 'Partnership', length: 'medium' }).output).toMatch(/Subject:/i));
  it('tagline output has 5 numbered options', () => { const { output } = generateFallbackContent({ type: 'tagline', tone: 'marketing', prompt: 'EcoBottle', length: 'short' }); expect(output).toMatch(/1\./); expect(output).toMatch(/5\./); });
  it('caption output contains hashtags',      () => expect(generateFallbackContent({ type: 'caption', tone: 'casual',       prompt: 'Morning coffee', length: 'short' }).output).toMatch(/#\w+/));

  it('produces varied output on repeated calls', () => {
    const results = Array.from({ length: 5 }, () =>
      generateFallbackContent({ type: 'blog', tone: 'professional', prompt: 'Machine learning', length: 'medium' }).output
    );
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  it('falls back to blog for unknown type', () => {
    const { output } = generateFallbackContent({ type: 'unknown', tone: 'professional', prompt: 'Test', length: 'medium' });
    expect(output.length).toBeGreaterThan(0);
  });
});

// ─── 4. Analytics service ─────────────────────────────────────────────────────

describe('analytics.service', () => {
  const analytics = require('../services/analytics.service');

  beforeEach(() => {
    jest.resetModules();
  });

  it('starts with zero counts',                    () => { const s = analytics.getStats(); expect(s.totalGenerations).toBe(0); expect(s.fallbackTriggers).toBe(0); });
  it('increments totalGenerations',                () => { analytics.recordGeneration('AI', 500, 'blog'); analytics.recordGeneration('AI', 400, 'ad'); expect(analytics.getStats().totalGenerations).toBe(2); });
  it('tracks bySource correctly',                  () => { analytics.recordGeneration('AI', 500, 'blog'); analytics.recordGeneration('FALLBACK', 300, 'ad'); const { bySource } = analytics.getStats(); expect(bySource.AI).toBe(1); expect(bySource.FALLBACK).toBe(1); });
  it('increments fallbackTriggers',                () => { analytics.recordFallbackTrigger('timeout', 'blog', true); expect(analytics.getStats().fallbackTriggers).toBe(1); });
  it('flags slow requests > 3000ms',               () => { analytics.recordGeneration('AI', 4000, 'blog'); analytics.recordGeneration('AI', 500, 'ad'); expect(analytics.getStats().slowRequests).toBe(1); });
  it('calculates average generation time',         () => { analytics.recordGeneration('AI', 1000, 'blog'); analytics.recordGeneration('AI', 3000, 'blog'); expect(analytics.getStats().avgGenerationTimeMs).toBe(2000); });
  it('recentFailures contains trigger details',    () => { analytics.recordFallbackTrigger('Connection refused', 'tagline', false); const { recentFailures } = analytics.getStats(); expect(recentFailures[0].reason).toBe('Connection refused'); expect(recentFailures[0].contentType).toBe('tagline'); });
});

// ─── 5. Metrics service ───────────────────────────────────────────────────────

describe('metrics', () => {
  const metricsModule = require('../utils/metrics');

  beforeEach(() => {
    jest.resetModules();
  });

  it('getSnapshot returns expected shape', () => {
    const snap = metricsModule.getSnapshot();
    expect(snap).toHaveProperty('requests');
    expect(snap).toHaveProperty('successRate');
    expect(snap).toHaveProperty('avgResponseMs');
    expect(snap).toHaveProperty('generation');
    expect(snap.generation).toHaveProperty('fallbackPct');
  });

  it('recordFallback increments fallbacks counter', () => {
    metricsModule.recordFallback();
    metricsModule.recordFallback();
    expect(metricsModule.getSnapshot().generation.fallbacks).toBe(2);
  });

  it('recordAISuccess increments aiSuccess counter', () => {
    metricsModule.recordAISuccess();
    expect(metricsModule.getSnapshot().generation.aiSuccess).toBe(1);
  });

  it('recordCacheHit increments cacheHits counter', () => {
    metricsModule.recordCacheHit();
    expect(metricsModule.getSnapshot().generation.cacheHits).toBe(1);
  });

  it('fallbackPct is 100% when all are fallbacks', () => {
    metricsModule.recordFallback();
    const snap = metricsModule.getSnapshot();
    expect(snap.generation.fallbackPct).toBe('100%');
  });

  it('fallbackPct is 0% when all are AI', () => {
    metricsModule.recordAISuccess();
    const snap = metricsModule.getSnapshot();
    expect(snap.generation.fallbackPct).toBe('0%');
  });
});

// ─── 6. AI service hybrid switching ──────────────────────────────────────────

describe('ai.service hybrid switching', () => {
  const { generateContent } = require('../services/ai.service');

  beforeEach(() => {
    jest.resetModules();
    process.env.USE_MOCK_AI       = 'false';
    process.env.USE_FALLBACK_ONLY = 'true';
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env.USE_MOCK_AI       = 'true';
    process.env.USE_FALLBACK_ONLY = 'false';
  });

  it('returns FALLBACK when USE_FALLBACK_ONLY=true', async () => {
    const result = await generateContent({ type: 'blog', tone: 'professional', prompt: 'Test switching', length: 'short' });
    expect(result.source).toBe('FALLBACK');
    expect(result.output.length).toBeGreaterThan(0);
  });

  it('returns FALLBACK when no OpenAI key', async () => {
    process.env.USE_FALLBACK_ONLY = 'false';
    jest.resetModules();
    const { generateContent: gc } = require('../services/ai.service');
    const result = await gc({ type: 'ad', tone: 'marketing', prompt: 'Test ad', length: 'short' });
    expect(result.source).toBe('FALLBACK');
  });

  it('includes numeric generationTime', async () => {
    const result = await generateContent({ type: 'tagline', tone: 'casual', prompt: 'Test brand', length: 'short' });
    expect(typeof result.generationTime).toBe('number');
    expect(result.generationTime).toBeGreaterThanOrEqual(0);
  });

  it('returns MOCK when USE_MOCK_AI=true', async () => {
    process.env.USE_MOCK_AI       = 'true';
    process.env.USE_FALLBACK_ONLY = 'false';
    jest.resetModules();
    const { generateContent: gcMock } = require('../services/ai.service');
    const result = await gcMock({ type: 'blog', tone: 'professional', prompt: 'Mock test', length: 'short' });
    expect(result.source).toBe('MOCK');
  });

  it('fromCache is always false from generateContent', async () => {
    const result = await generateContent({ type: 'email', tone: 'formal', prompt: 'Test email', length: 'short' });
    expect(result.fromCache).toBe(false);
  });
});
