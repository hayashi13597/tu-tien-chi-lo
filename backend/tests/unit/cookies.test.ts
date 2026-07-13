import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setAuthCookies, clearAuthCookies } from '../../src/presentation/cookies';

function buildTestApp() {
  const app = express();
  app.get('/set', (_req, res) => {
    setAuthCookies(res, 'the-access-token', 'the-refresh-token');
    res.status(200).json({ ok: true });
  });
  app.get('/clear', (_req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('setAuthCookies', () => {
  it('sets both cookies as httpOnly with the expected names and values', async () => {
    const res = await request(buildTestApp()).get('/set');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    expect(accessCookie).toContain('access_token=the-access-token');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toContain('SameSite=Lax');

    expect(refreshCookie).toContain('refresh_token=the-refresh-token');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toContain('SameSite=Lax');
  });

  it('sets access_token with a 15-minute max-age and refresh_token with a 7-day max-age', async () => {
    const res = await request(buildTestApp()).get('/set');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    // Express renders maxAge (ms) as a Max-Age (seconds) attribute.
    expect(accessCookie).toContain(`Max-Age=${15 * 60}`);
    expect(refreshCookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  });
});

describe('clearAuthCookies', () => {
  it('clears both cookies with an expired date and matching path', async () => {
    const res = await request(buildTestApp()).get('/clear');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    expect(accessCookie).toContain('access_token=;');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toContain('Expires=Thu, 01 Jan 1970');

    expect(refreshCookie).toContain('refresh_token=;');
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});
