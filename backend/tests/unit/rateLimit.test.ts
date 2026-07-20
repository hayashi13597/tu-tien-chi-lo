import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authRateLimiter } from '../../src/presentation/middleware/rateLimit';

// The limiter is skipped when NODE_ENV === 'test' (the whole suite runs there),
// so to exercise the real limiting path we flip NODE_ENV per-request — skip()
// is evaluated on each request, not once at construction.
describe('authRateLimiter', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  function makeApp() {
    const app = express();
    app.post('/probe', authRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    return app;
  }

  it('is inert under NODE_ENV=test (suite must not trip the shared limiter)', async () => {
    process.env.NODE_ENV = 'test';
    const app = makeApp();
    // Well past the limit of 20 — all should pass because skip() short-circuits.
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/probe');
      expect(res.status).toBe(200);
    }
  });

  it('returns a 429 with the shared error shape once the limit is exceeded', async () => {
    process.env.NODE_ENV = 'production';
    const app = makeApp();
    let last = await request(app).post('/probe');
    // Drive requests until the limiter trips (limit is 20 per window).
    for (let i = 0; i < 25 && last.status === 200; i++) {
      last = await request(app).post('/probe');
    }
    expect(last.status).toBe(429);
    expect(last.body).toEqual({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
    });
  });
});
