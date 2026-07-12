import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequireAuth, AuthedRequest } from '../../src/presentation/middleware/auth';
import { FakeTokenService } from '../fakes/FakeTokenService';

function buildTestApp() {
  const app = express();
  const requireAuth = createRequireAuth(new FakeTokenService());
  app.get('/protected', requireAuth, (req: AuthedRequest, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('rejects requests with no Authorization header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid token with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token and attaches userId', async () => {
    const token = new FakeTokenService().signAccessToken('user-123');
    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-123');
  });
});
