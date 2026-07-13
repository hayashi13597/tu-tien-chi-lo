import { Response } from 'express';

// Shared attributes for both cookies. secure is gated on NODE_ENV so cookies
// still work over plain http://localhost in dev, but are forced over HTTPS
// once deployed. Centralizing these means all 4 call sites (register, login,
// refresh, logout) can never drift out of sync with each other.
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, { ...COOKIE_BASE_OPTIONS, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_BASE_OPTIONS, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
}

export function clearAuthCookies(res: Response): void {
  // clearCookie's own expires/maxAge is always overridden to a past date
  // regardless of what's passed, but its `path` is NOT auto-matched to what
  // cookie() used — passing the same path: '/' here is what makes the
  // browser recognize this as the same cookie and actually delete it.
  res.clearCookie('access_token', { path: COOKIE_BASE_OPTIONS.path });
  res.clearCookie('refresh_token', { path: COOKIE_BASE_OPTIONS.path });
}
