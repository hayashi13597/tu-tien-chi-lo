import { describe, it, expect } from 'vitest';
import { DomainError } from '../../src/domain/errors';

describe('DomainError', () => {
  it('is an Error carrying a machine-readable code', () => {
    const err = new DomainError('USERNAME_TAKEN', 'Username already exists');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('USERNAME_TAKEN');
    expect(err.message).toBe('Username already exists');
    expect(err.name).toBe('DomainError');
  });
});
