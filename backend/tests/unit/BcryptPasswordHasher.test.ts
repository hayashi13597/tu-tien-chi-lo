import { describe, it, expect } from 'vitest';
import { BcryptPasswordHasher } from '../../src/infrastructure/auth/BcryptPasswordHasher';

describe('BcryptPasswordHasher', () => {
  it('hashes a password and verifies it back with compare', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('password123');
    expect(hash).not.toBe('password123');
    expect(await hasher.compare('password123', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('password123');
    expect(await hasher.compare('wrongpass', hash)).toBe(false);
  });
});
