import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/presentation/middleware/errorHandler';
import { DomainError } from '../../src/domain/errors';

function buildTestApp() {
  const app = express();
  app.get('/boom-username-taken', () => {
    throw new DomainError('USERNAME_TAKEN', 'Username already exists');
  });
  app.get('/boom-invalid-refresh-token', () => {
    throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  });
  app.get('/boom-unknown-code', () => {
    throw new DomainError('SOMETHING_NEW', 'Not yet mapped');
  });
  app.get('/boom-forbidden', () => {
    throw new DomainError('FORBIDDEN', 'Admin privileges required');
  });
  app.get('/boom-invalid-realm-config', () => {
    throw new DomainError('INVALID_REALM_CONFIG', 'bad config');
  });
  app.get('/boom-user-not-found', () => {
    throw new DomainError('USER_NOT_FOUND', 'User no longer exists');
  });
  app.get('/boom-invalid-pill-config', () => {
    throw new DomainError('INVALID_PILL_CONFIG', 'bad pill');
  });
  app.get('/boom-pill-id-taken', () => {
    throw new DomainError('PILL_ID_TAKEN', 'id already exists');
  });
  app.get('/boom-unexpected', () => {
    throw new Error('unexpected');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps a known DomainError code to its HTTP status', async () => {
    const res = await request(buildTestApp()).get('/boom-username-taken');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
  });

  it('maps INVALID_REFRESH_TOKEN to 401', async () => {
    const res = await request(buildTestApp()).get('/boom-invalid-refresh-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
    });
  });

  it('falls back to 500 for a DomainError code with no status mapping', async () => {
    const res = await request(buildTestApp()).get('/boom-unknown-code');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SOMETHING_NEW');
  });

  it('maps FORBIDDEN to 403', async () => {
    const res = await request(buildTestApp()).get('/boom-forbidden');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } });
  });

  it('maps INVALID_REALM_CONFIG to 400', async () => {
    const res = await request(buildTestApp()).get('/boom-invalid-realm-config');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REALM_CONFIG');
  });

  it('maps USER_NOT_FOUND to 401', async () => {
    const res = await request(buildTestApp()).get('/boom-user-not-found');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' } });
  });

  it('maps INVALID_PILL_CONFIG to 400', async () => {
    const res = await request(buildTestApp()).get('/boom-invalid-pill-config');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PILL_CONFIG');
  });

  it('maps PILL_ID_TAKEN to 409', async () => {
    const res = await request(buildTestApp()).get('/boom-pill-id-taken');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PILL_ID_TAKEN');
  });

  it('formats a non-DomainError as a 500 INTERNAL_ERROR', async () => {
    const res = await request(buildTestApp()).get('/boom-unexpected');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
