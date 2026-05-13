const config = require('./config');

// ── Top-level constants resolved at module load time ─────────────────────────
const SLOW_THRESHOLD_MS = config.analytics.slowThresholdMs;
const MAX_ANALYTICS_EVENTS = config.analytics.maxEvents;
const FEATURES          = config.features;
const NODE_ENV          = config.nodeEnv;

// ── Counters ──────────────────────────────────────────────────────────────────
const counters = {
  requests:  0,
  success:   0,
  errors:    0,
  fallbacks: 0,
  aiSuccess: 0,
  cacheHits: 0,
};

// ── Rolling response-time samples (last 500 requests) ────────────────────────
const responseTimes = [];
const MAX_SAMPLES   = 500;

// ── Per-route breakdown ───────────────────────────────────────────────────────
const routeStats = {};

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Express middleware — attach to app before routes.
 * Records response time and status for every request.
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms    = Date.now() - start;
    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const isErr = res.statusCode >= 400;

    counters.requests++;
    if (isErr) counters.errors++;
    else       counters.success++;

    if (responseTimes.length >= MAX_SAMPLES) responseTimes.shift();
    responseTimes.push(ms);

    if (!routeStats[route]) routeStats[route] = { count: 0, errors: 0, totalMs: 0 };
    routeStats[route].count++;
    routeStats[route].totalMs += ms;
    if (isErr) routeStats[route].errors++;

    if (ms > SLOW_THRESHOLD_MS) {
      console.warn(JSON.stringify({
        ts:      new Date().toISOString(),
        level:   'warn',
        message: 'slow_request',
        route,
        ms,
        status:  res.statusCode,
      }));
    }
  });

  next();
}

// ── Event recorders (called by ai.service) ────────────────────────────────────

function recordFallback()  { counters.fallbacks++; }
function recordAISuccess() { counters.aiSuccess++;  }
function recordCacheHit()  { counters.cacheHits++;  }

// ── Snapshot ──────────────────────────────────────────────────────────────────

function getSnapshot() {
  const avgResponseMs = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const totalGen    = counters.aiSuccess + counters.fallbacks;
  const fallbackPct = totalGen > 0
    ? Math.round((counters.fallbacks / totalGen) * 100)
    : 0;

  const successRate = counters.requests > 0
    ? Math.round((counters.success / counters.requests) * 100)
    : 100;

  const topRoutes = Object.entries(routeStats)
    .map(([route, s]) => ({
      route,
      count:  s.count,
      errors: s.errors,
      avgMs:  Math.round(s.totalMs / s.count),
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10);

  return {
    uptime:        Math.round(process.uptime()),
    env:           NODE_ENV,
    maxEvents:     MAX_ANALYTICS_EVENTS,
    requests:      counters.requests,
    successRate:   `${successRate}%`,
    errors:        counters.errors,
    avgResponseMs,
    generation: {
      aiSuccess:   counters.aiSuccess,
      fallbacks:   counters.fallbacks,
      cacheHits:   counters.cacheHits,
      fallbackPct: `${fallbackPct}%`,
    },
    topRoutes,
    features:      FEATURES,
    ts:            new Date().toISOString(),
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  metricsMiddleware,
  recordFallback,
  recordAISuccess,
  recordCacheHit,
  getSnapshot,
};
