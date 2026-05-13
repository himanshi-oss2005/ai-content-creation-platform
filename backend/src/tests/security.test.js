/**
 * Security Tests — WriteGen AI
 * Covers: input validation, auth protection, injection attempts, header checks
 * Run: npm test
 */

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');

const TEST_DB            = process.env.MONGO_URI_TEST     || 'mongodb://localhost:27017/writegen_security_test';
const TEST_PASSWORD      = process.env.TEST_USER_PASSWORD;
const TEST_SHORT_PASSWORD = process.env.TEST_SHORT_PASSWORD || '123';
if (!TEST_PASSWORD) throw new Error('TEST_USER_PASSWORD env var is required');

beforeAll(async () => { await mongoose.connect(TEST_DB); });
afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerAndLogin(suffix = '') {
  const email = `sec${suffix}${Date.now()}@test.com`;
  await request(app).post('/api/auth/register').send({ name: 'Sec User', email, password: TEST_PASSWORD });
  const res = await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
  return res.body.token;
}

// ── 1. Security headers ───────────────────────────────────────────────────────

describe('Security headers', () => {
  it('does not expose X-Powered-By header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

// ── 2. Auth protection ────────────────────────────────────────────────────────

describe('Auth protection', () => {
  it('rejects request to /api/content/generate without token', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .send({ type: 'blog', tone: 'professional', prompt: 'Test prompt here' });
    expect(res.status).toBe(401);
  });

  it('rejects request to /api/content/history without token', async () => {
    const res = await request(app).get('/api/content/history');
    expect(res.status).toBe(401);
  });

  it('rejects request to /api/users/profile without token', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('rejects request to /api/admin/stats without token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('rejects request to /api/admin/stats with non-admin token', async () => {
    const token = await registerAndLogin('admin');
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects malformed JWT token', async () => {
    const res = await request(app)
      .get('/api/content/history')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('rejects token with wrong algorithm (none)', async () => {
    // Craft a token with alg:none — should be rejected
    const payload = Buffer.from(JSON.stringify({ id: 'fakeid' })).toString('base64');
    const header  = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const fakeToken = `${header}.${payload}.`;
    const res = await request(app)
      .get('/api/content/history')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });
});

// ── 3. Input validation ───────────────────────────────────────────────────────

describe('Input validation', () => {
  let token;
  beforeAll(async () => { token = await registerAndLogin('input'); });

  it('rejects register with invalid email', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects register with short password', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Bad', email: 'short@test.com', password: TEST_SHORT_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects register with missing name', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'noname@test.com', password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects generate with invalid content type', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'malicious_type', tone: 'professional', prompt: 'Test prompt here' });
    expect(res.status).toBe(400);
  });

  it('rejects generate with prompt too short', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'blog', tone: 'professional', prompt: 'Hi' });
    expect(res.status).toBe(400);
  });

  it('rejects generate with prompt too long', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'blog', tone: 'professional', prompt: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('rejects generate with invalid tone', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'blog', tone: 'aggressive', prompt: 'Valid prompt here' });
    expect(res.status).toBe(400);
  });

  it('rejects generate with too many keywords', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'blog', tone: 'professional', prompt: 'Valid prompt here',
        keywords: Array.from({ length: 11 }, (_, i) => `kw${i}`),
      });
    expect(res.status).toBe(400);
  });

  it('rejects history query with invalid page param', async () => {
    const res = await request(app)
      .get('/api/content/history?page=-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects history query with invalid dateFrom', async () => {
    const res = await request(app)
      .get('/api/content/history?dateFrom=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects content delete with invalid MongoDB ID', async () => {
    const res = await request(app)
      .delete('/api/content/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ── 4. NoSQL injection protection ────────────────────────────────────────────

describe('NoSQL injection protection', () => {
  it('rejects login with operator injection in email field', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: TEST_PASSWORD });
    // Should be rejected by validation (email must be a string/email format)
    expect([400, 401]).toContain(res.status);
    // Must NOT return a token
    expect(res.body.token).toBeUndefined();
  });

  it('rejects login with operator injection in password field', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: { $ne: null } });
    expect([400, 401]).toContain(res.status);
    expect(res.body.token).toBeUndefined();
  });

  it('sanitizes MongoDB operators from query strings', async () => {
    const token = await registerAndLogin('nosql');
    // Attempt to inject $where into search param
    const res = await request(app)
      .get('/api/content/history?search[$where]=1')
      .set('Authorization', `Bearer ${token}`);
    // Should either sanitize and return 200, or reject with 400 — never 500
    expect(res.status).not.toBe(500);
  });
});

// ── 5. Oversized payload protection ──────────────────────────────────────────

describe('Payload size protection', () => {
  it('rejects JSON body larger than 10kb', async () => {
    const token = await registerAndLogin('payload');
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'blog', tone: 'professional', prompt: 'x'.repeat(12000) }));
    // Either 400 (validation) or 413 (payload too large)
    expect([400, 413]).toContain(res.status);
  });
});

// ── 6. Health endpoint ────────────────────────────────────────────────────────

describe('Health endpoint', () => {
  it('returns ok status without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('does not expose stack traces in health response', async () => {
    const res = await request(app).get('/health');
    expect(res.body.stack).toBeUndefined();
  });
});
