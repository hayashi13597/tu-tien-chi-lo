import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createRequireAuth, AuthedRequest } from '../../src/presentation/middleware/auth';
import { FakeTokenService } from '../fakes/FakeTokenService';

function buildTestApp() {
  const app = express();
  app.use(cookieParser());
  const requireAuth = createRequireAuth(new FakeTokenService());
  app.get('/protected', requireAuth, (req: AuthedRequest, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('rejects requests with neither a cookie nor a header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid Authorization header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid access_token cookie with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Cookie', 'access_token=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid Authorization header and attaches userId (existing header-only callers keep working)', async () => {
    const token = new FakeTokenService().signAccessToken('user-123');
    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-123');
  });

  it('allows requests with a valid access_token cookie and attaches userId', async () => {
    const token = new FakeTokenService().signAccessToken('user-456');
    const res = await request(buildTestApp()).get('/protected').set('Cookie', `access_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-456');
  });

  it('prefers the cookie over the header when both are present and resolve to different users', async () => {
    const cookieToken = new FakeTokenService().signAccessToken('user-from-cookie');
    const headerToken = new FakeTokenService().signAccessToken('user-from-header');
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${cookieToken}`)
      .set('Authorization', `Bearer ${headerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-from-cookie');
  });

  it('rejects a refresh token presented as the access_token cookie with 401', () => {
    const refreshToken = new FakeTokenService().signRefreshToken('user-123');
    return request(buildTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${refreshToken}`)
      .then((res) => {
        expect(res.status).toBe(401);
      });
  });
});
