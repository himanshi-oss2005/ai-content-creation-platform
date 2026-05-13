const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

const TEST_USER_EMAIL    = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const TEST_WRONG_PASSWORD = process.env.TEST_WRONG_PASSWORD || 'wrong-password-placeholder';
const TEST_SHORT_PASSWORD = process.env.TEST_SHORT_PASSWORD || '123';
if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD env vars are required');
}
const TEST_DB = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/writegen_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a new user and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.password).toBeUndefined(); // never exposed
  });

  it('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User',
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects invalid email with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad',
      email: 'not-an-email',
      password: TEST_USER_PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it('rejects short password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad',
      email: 'short@writegen.ai',
      password: TEST_SHORT_PASSWORD,
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USER_EMAIL,
      password: TEST_WRONG_PASSWORD,
    });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@writegen.ai',
      password: TEST_USER_PASSWORD,
    });
    expect(res.status).toBe(401);
  });
});

// ── Content (authenticated) ───────────────────────────────────────────────────

describe('Content API', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    token = res.body.token;
  });

  it('generates content with valid payload', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'blog', tone: 'professional', prompt: 'Benefits of TypeScript in large projects' });

    expect(res.status).toBe(201);
    expect(res.body.content).toHaveProperty('output');
    expect(res.body.content.type).toBe('blog');
    expect(res.body).toHaveProperty('creditsRemaining');
  });

  it('rejects generation without auth', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .send({ type: 'blog', tone: 'professional', prompt: 'Test prompt here' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid content type', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'invalid_type', tone: 'professional', prompt: 'Test prompt here' });
    expect(res.status).toBe(400);
  });

  it('rejects prompt that is too short', async () => {
    const res = await request(app)
      .post('/api/content/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'blog', tone: 'professional', prompt: 'Hi' });
    expect(res.status).toBe(400);
  });

  it('returns content history', async () => {
    const res = await request(app)
      .get('/api/content/history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns dashboard stats', async () => {
    const res = await request(app)
      .get('/api/content/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalContent');
    expect(res.body).toHaveProperty('weeklyUsage');
    expect(res.body).toHaveProperty('byType');
  });
});

// ── Health ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
