/**
 * Analytics Service — in-memory event tracking for admin dashboard.
 * Tracks: AI failures, fallback triggers, slow requests, generation counts.
 * Uses a rolling 24-hour window; no external dependency required.
 */

const logger = require('../utils/logger');
const config = require('../utils/config');

const SLOW_THRESHOLD_MS = config.analytics.slowThresholdMs;

// ─── In-memory circular-buffer event store ───────────────────────────────────

const MAX_EVENTS = 2000;
const events     = new Array(MAX_EVENTS);
let   head       = 0;   // next write position
let   size       = 0;   // current number of valid entries

function record(type, meta = {}) {
  events[head] = { type, ts: Date.now(), meta };
  head = (head + 1) % MAX_EVENTS;
  if (size < MAX_EVENTS) size++;
}

/** Iterate valid events newest-first. */
function* iterEvents() {
  for (let i = 1; i <= size; i++) {
    const idx = (head - i + MAX_EVENTS) % MAX_EVENTS;
    yield events[idx];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a completed generation event.
 * @param {'AI'|'MOCK'|'FALLBACK'} source
 * @param {number} generationTime  ms
 * @param {string} contentType
 */
function recordGeneration(source, generationTime, contentType) {
  record('generation', { source, generationTime, contentType });

  if (generationTime > SLOW_THRESHOLD_MS) {
    logger.warn('slow_generation', { source, generationTime, contentType });
    record('slow_request', { source, generationTime, contentType });
  }
}

/**
 * Record an AI API failure that triggered the fallback.
 * @param {string} reason  Error message
 * @param {string} contentType
 * @param {boolean} isTimeout
 */
function recordFallbackTrigger(reason, contentType, isTimeout = false) {
  logger.warn('ai_fallback_triggered', { reason, contentType, isTimeout });
  record('fallback_trigger', { reason, contentType, isTimeout });
}

/**
 * Return aggregated stats for the admin dashboard.
 * Covers the last 24 hours by default.
 */
function getStats(windowMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - windowMs;

  const generations  = [];
  const fallbacks    = [];
  const slowRequests = [];

  for (const e of iterEvents()) {
    if (e.ts < cutoff) break; // events are newest-first; stop at window boundary
    if (e.type === 'generation')     generations.push(e);
    if (e.type === 'fallback_trigger') fallbacks.push(e);
    if (e.type === 'slow_request')   slowRequests.push(e);
  }

  const bySource = generations.reduce((acc, e) => {
    acc[e.meta.source] = (acc[e.meta.source] || 0) + 1;
    return acc;
  }, {});

  const byContentType = generations.reduce((acc, e) => {
    acc[e.meta.contentType] = (acc[e.meta.contentType] || 0) + 1;
    return acc;
  }, {});

  const avgGenTime = generations.length
    ? Math.round(generations.reduce((s, e) => s + (e.meta.generationTime || 0), 0) / generations.length)
    : 0;

  return {
    window:         '24h',
    totalGenerations: generations.length,
    bySource,
    byContentType,
    avgGenerationTimeMs: avgGenTime,
    fallbackTriggers:    fallbacks.length,
    slowRequests:        slowRequests.length,
    recentFailures:      fallbacks.slice(-10).reverse().map((e) => ({
      reason:      e.meta.reason,
      contentType: e.meta.contentType,
      isTimeout:   e.meta.isTimeout,
      ts:          new Date(e.ts).toISOString(),
    })),
  };
}

module.exports = { recordGeneration, recordFallbackTrigger, getStats };
