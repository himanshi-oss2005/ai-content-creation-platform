const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const mongoSanitize  = require('express-mongo-sanitize');
const compression    = require('compression');
const swaggerJsdoc   = require('swagger-jsdoc');
const swaggerUi      = require('swagger-ui-express');
const xssClean       = require('xss-clean');
const cookieParser   = require('cookie-parser');

const config               = require('./utils/config');
const AppError             = require('./utils/AppError');
const logger               = require('./utils/logger');
const metrics              = require('./utils/metrics');
const { globalErrorHandler } = require('./middleware/error.middleware');
const { setCsrfCookie, requireCsrfHeader } = require('./middleware/csrf.middleware');
const { handleWebhook }                    = require('./controllers/payment.controller');

const authRoutes     = require('./routes/auth.routes');
const contentRoutes  = require('./routes/content.routes');
const userRoutes     = require('./routes/user.routes');
const paymentRoutes  = require('./routes/payment.routes');
const templateRoutes = require('./routes/template.routes');
const adminRoutes    = require('./routes/admin.routes');

const app = express();
app.set('trust proxy', 1);

// ── HTTP → HTTPS redirect in production ────────────────────────────────────────
const _trustedHosts = new Set(
  config.frontendUrl.map((u) => new URL(u).host)
);
app.use((req, res, next) => {
  if (config.isProd && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    const host = req.headers.host;
    if (!host || !_trustedHosts.has(host)) {
      return res.status(400).end();
    }
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});

// ── Security headers ─────────────────────────────────────────────────────────
app.disable('x-powered-by'); // don't advertise Express
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'", 'https:', 'data:'],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: config.isProd ? [] : null,
    },
  },
  hsts: config.isProd ? {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera:     [],
      microphone: [],
      payment:    [],
      geolocation: [],
      syncXhr:    [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.frontendUrl.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-Token'],
}));

// ── Body parsing and sanitization ─────────────────────────────────────────────
const webhookPaths = ['/api/payments/webhook', '/webhook', '/api/webhook'];
app.use(webhookPaths, express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (webhookPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  return express.json({ limit: '10kb' })(req, res, (err) => {
    if (err) return next(err);
    xssClean()(req, res, (cleanErr) => {
      if (cleanErr) return next(cleanErr);
      mongoSanitize()(req, res, next);
    });
  });
});
app.use(cookieParser());

// ── CSRF protection (double-submit cookie pattern) ──────────────────────────
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/payments/webhook') ||
    req.path.startsWith('/webhook') ||
    req.path.startsWith('/api/webhook')
  ) return next();
  return setCsrfCookie(req, res, next);
});

// Apply CSRF header validation globally to all mutating API routes
// except the Stripe webhook which uses signature verification instead
app.use('/api/auth',      requireCsrfHeader);
app.use('/api/content',   requireCsrfHeader);
app.use('/api/users',     requireCsrfHeader);
app.use('/api/payments/checkout', requireCsrfHeader);
app.use('/api/payments/cancel',   requireCsrfHeader);
app.use('/api/templates', requireCsrfHeader);
app.use('/api/admin',     requireCsrfHeader);
app.use('/api/collections', requireCsrfHeader);

// ── Observability ─────────────────────────────────────────────────────────────
app.use(metrics.metricsMiddleware);
app.use((req, _res, next) => { logger.request(req); next(); });

// ── Global rate limiter ───────────────────────────────────────────────────────
// Skip GET requests — only rate limit mutating operations (POST, PUT, PATCH, DELETE)
app.use('/api/', rateLimit({
  windowMs:       config.rateLimit.global.windowMs,
  max:            config.rateLimit.global.max,
  standardHeaders: true,
  legacyHeaders:  false,
  message:        { error: 'Too many requests, please try again later.' },
  skip:           (req) => req.method === 'GET',
}));

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'WriteGen AI API',
      version:     '2.0.0',
      description: 'AI Content Generator Platform — Full API Reference',
    },
    servers:    [{ url: '/api' }],
    security:   [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',      description: 'Authentication' },
      { name: 'Content',   description: 'AI content generation' },
      { name: 'Templates', description: 'Prompt templates' },
      { name: 'Users',     description: 'Profile & credits' },
      { name: 'Payments',  description: 'Stripe subscription' },
      { name: 'Admin',     description: 'Admin-only' },
      { name: 'System',    description: 'Health & metrics' },
    ],
    paths: {
      '/auth/register':         { post:   { tags: ['Auth'],      summary: 'Register new user',           security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name','email','password'], properties: { name: { type: 'string', example: 'Jane Doe' }, email: { type: 'string', format: 'email', example: 'jane@example.com' }, password: { type: 'string', minLength: 6, example: 'secret123' } } } } } }, responses: { 201: { description: 'User created + JWT token' }, 409: { description: 'Email already registered' } } } },
      '/auth/login':            { post:   { tags: ['Auth'],      summary: 'Login',                       security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email','password'], properties: { email: { type: 'string', example: 'jane@example.com' }, password: { type: 'string', example: 'secret123' } } } } } }, responses: { 200: { description: 'JWT token returned' }, 401: { description: 'Invalid credentials' } } } },
      '/auth/me':               { get:    { tags: ['Auth'],      summary: 'Get current user',            responses: { 200: { description: 'User object' } } } },
      '/content/generate':      { post:   { tags: ['Content'],   summary: 'Generate AI content (1 credit)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerateRequest' } } } }, responses: { 201: { description: 'Content generated', content: { 'application/json': { example: { content: { _id: '...', type: 'blog', output: '...' }, source: 'AI', generationTime: 1240, creditsRemaining: 9 } } } }, 429: { description: 'Credit limit reached' } } } },
      '/content/generate/ab':   { post:   { tags: ['Content'],   summary: 'A/B generate 2 variants (2 credits)', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerateRequest' } } } }, responses: { 201: { description: 'variantA + variantB returned' } } } },
      '/content/ab/select':     { post:   { tags: ['Content'],   summary: 'Select preferred A/B variant', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['selectedId','rejectedId'], properties: { selectedId: { type: 'string' }, rejectedId: { type: 'string' } } } } } }, responses: { 200: { description: 'Selected variant favorited, rejected deleted' } } } },
      '/content/history':       { get:    { tags: ['Content'],   summary: 'Paginated content history',   parameters: [{ in: 'query', name: 'page', schema: { type: 'integer', default: 1 } }, { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } }, { in: 'query', name: 'type', schema: { type: 'string' } }, { in: 'query', name: 'search', schema: { type: 'string' } }, { in: 'query', name: 'favorites', schema: { type: 'boolean' } }, { in: 'query', name: 'dateFrom', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'dateTo', schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Paginated items' } } } },
      '/content/stats':         { get:    { tags: ['Content'],   summary: 'Dashboard stats',             responses: { 200: { description: 'Stats object' } } } },
      '/content/{id}':          { delete: { tags: ['Content'],   summary: 'Delete content item',         parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } } },
      '/content/{id}/favorite': { patch:  { tags: ['Content'],   summary: 'Toggle favorite',             parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'isFavorite toggled' } } } },
      '/templates':             { get:    { tags: ['Templates'],  summary: 'List system + custom templates', responses: { 200: { description: 'System and custom template arrays' } } }, post: { tags: ['Templates'], summary: 'Create custom template', responses: { 201: { description: 'Template created' } } } },
      '/templates/{id}':        { patch:  { tags: ['Templates'],  summary: 'Update template (saves version)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } }, delete: { tags: ['Templates'], summary: 'Delete template', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Deleted' } } } },
      '/templates/{id}/use':    { post:   { tags: ['Templates'],  summary: 'Increment template usage count', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Updated' } } } },
      '/users/profile':         { get:    { tags: ['Users'],      summary: 'Get profile',                 responses: { 200: { description: 'User profile' } } }, patch: { tags: ['Users'], summary: 'Update display name', responses: { 200: { description: 'Updated' } } } },
      '/users/transactions':    { get:    { tags: ['Users'],      summary: 'Transaction history',         responses: { 200: { description: 'Transaction list' } } } },
      '/payments/checkout':     { post:   { tags: ['Payments'],   summary: 'Create Stripe checkout session', responses: { 200: { description: 'Checkout URL' } } } },
      '/payments/cancel':       { post:   { tags: ['Payments'],   summary: 'Cancel subscription',         responses: { 200: { description: 'Cancelled' } } } },
      '/admin/stats':           { get:    { tags: ['Admin'],      summary: 'Platform-wide stats',         responses: { 200: { description: 'Admin stats + realtime analytics' } } } },
      '/admin/users':           { get:    { tags: ['Admin'],      summary: 'Paginated user list',         parameters: [{ in: 'query', name: 'search', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }], responses: { 200: { description: 'User list' } } } },
      '/admin/users/{id}/role': { patch:  { tags: ['Admin'],      summary: 'Upgrade / downgrade user',    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string', enum: ['free','premium'] } } } } } }, responses: { 200: { description: 'Role updated' } } } },
      '/admin/analytics':       { get:    { tags: ['Admin'],      summary: 'Real-time generation analytics', responses: { 200: { description: 'Analytics snapshot' } } } },
      '/metrics':               { get:    { tags: ['System'],     summary: 'API performance metrics',     security: [], responses: { 200: { description: 'Metrics snapshot' } } } },
    },
    components: {
      schemas: {
        GenerateRequest: {
          type: 'object', required: ['type','tone','prompt'],
          properties: {
            type:     { type: 'string', enum: ['blog','ad','caption','product_description','email','tagline'], example: 'blog' },
            tone:     { type: 'string', enum: ['professional','casual','marketing','funny','formal'],          example: 'professional' },
            prompt:   { type: 'string', minLength: 5, maxLength: 500, example: 'Benefits of remote work for software engineers' },
            length:   { type: 'string', enum: ['short','medium','long'],                                       example: 'medium' },
            language: { type: 'string', example: 'English' },
            keywords: { type: 'array', items: { type: 'string' }, example: ['productivity','async'] },
          },
        },
      },
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'WriteGen AI — API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/content',   contentRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/payments',  paymentRoutes);
app.post('/webhook',      handleWebhook);
app.post('/api/webhook',  handleWebhook);
app.use('/api/templates', templateRoutes);
app.use('/api/admin',     adminRoutes);

// ── Metrics endpoint (open in dev, admin-only in production) ──────────────────
const { authenticate: mAuth, requireAdmin: mAdmin } = require('./middleware/auth.middleware');
if (config.isProd) {
  app.get('/api/metrics', mAuth, mAdmin, (_req, res) => res.json(metrics.getSnapshot()));
} else {
  app.get('/api/metrics', (_req, res) => res.json(metrics.getSnapshot()));
}

// ── Root ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ name: 'WriteGen AI API', docs: '/api-docs', health: '/health' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status:  'ok',
  env:     config.nodeEnv,
  uptime:  Math.round(process.uptime()),
  ts:      new Date().toISOString(),
  features: config.features,
}));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, _res, next) => next(new AppError('Route not found', 404)));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(globalErrorHandler);

module.exports = app;
