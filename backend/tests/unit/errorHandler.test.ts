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

  it('formats a non-DomainError as a 500 INTERNAL_ERROR', async () => {
    const res = await request(buildTestApp()).get('/boom-unexpected');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
