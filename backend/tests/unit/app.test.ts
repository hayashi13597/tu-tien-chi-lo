import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../../src/app';

describe('createApp startup validation', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  const originalNodeEnv = process.env.NODE_ENV;

  // Restore each captured var to its exact original: assigning `process.env.X =
  // undefined` would coerce to the string "undefined", so an originally-unset
  // var must be deleted, not assigned.
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  afterEach(() => {
    restore('JWT_SECRET', originalSecret);
    restore('JWT_REFRESH_SECRET', originalRefreshSecret);
    restore('CORS_ORIGIN', originalCorsOrigin);
    restore('NODE_ENV', originalNodeEnv);
  });

  it('throws at startup if JWT_SECRET and JWT_REFRESH_SECRET are set to the same value', () => {
    process.env.JWT_SECRET = 'identical-secret';
    process.env.JWT_REFRESH_SECRET = 'identical-secret';

    expect(() => createApp()).toThrow('JWT_SECRET and JWT_REFRESH_SECRET must be set to different values');
  });

  it('does not throw when the two secrets differ', () => {
    process.env.JWT_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    expect(() => createApp()).not.toThrow();
  });

  it('throws at startup if only one JWT secret is set (would sign with an undefined key)', () => {
    process.env.JWT_SECRET = 'access-secret';
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => createApp()).toThrow('JWT_SECRET and JWT_REFRESH_SECRET must both be set');
  });

  it('throws at startup if CORS_ORIGIN is unset (would otherwise reflect any origin with credentials)', () => {
    process.env.JWT_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    delete process.env.CORS_ORIGIN;

    expect(() => createApp()).toThrow('CORS_ORIGIN must be set');
  });

  it('refuses to start in production with the default dev JWT secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'dev-secret-change-me';
    process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';

    expect(() => createApp()).toThrow('Refusing to start in production with default dev JWT secrets');
  });

  it('allows the default dev secrets outside production (local/dev/test workflow)', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'dev-secret-change-me';
    process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';

    expect(() => createApp()).not.toThrow();
  });

  it('starts in production when real (non-default) secrets are provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-access-secret';
    process.env.JWT_REFRESH_SECRET = 'a-real-refresh-secret';

    expect(() => createApp()).not.toThrow();
  });
});
