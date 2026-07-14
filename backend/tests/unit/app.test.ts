import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../../src/app';

describe('createApp startup validation', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
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
});
