const isProd = process.env.NODE_ENV === 'production';

const LEVELS = { info: '📘', warn: '⚠️ ', error: '❌', debug: '🔍' };

// Redact IP to first two octets in production to reduce PII exposure.
// e.g. 203.0.113.42 → 203.0.x.x
function redactIp(ip) {
  if (!ip) return 'unknown';
  if (!isProd) return ip;
  const parts = ip.replace('::ffff:', '').split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return 'redacted'; // IPv6 — fully redact
}

function log(level, message, meta = {}) {
  const entry = {
    ts:      new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  if (isProd) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const prefix  = `${LEVELS[level] ?? '  '} [${entry.ts.slice(11, 19)}]`;
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    console.log(`${prefix} ${message}${metaStr}`);
  }
}

const logger = {
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),

  request: (req) => log('info', `${req.method} ${req.originalUrl}`, {
    ip: redactIp(req.ip),
    ua: req.headers['user-agent']?.slice(0, 80),
  }),

  credit: (userId, type, remaining) => log('info', 'credit_used', {
    userId:      userId?.toString(),
    contentType: type,
    remaining,
  }),

  // Security events — always logged, never silenced
  security: (event, meta = {}) => log('warn', `security_event:${event}`, meta),
};

module.exports = logger;
