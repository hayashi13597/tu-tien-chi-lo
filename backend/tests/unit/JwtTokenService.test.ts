import { describe, it, expect } from 'vitest';
import { JwtTokenService } from '../../src/infrastructure/auth/JwtTokenService';

describe('JwtTokenService', () => {
  it('signs a token that verifies back to the same userId', () => {
    const service = new JwtTokenService('test-secret');
    const token = service.signAccessToken('user-123');
    expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123' });
  });

  it('throws when verifying a token signed with a different secret', () => {
    const signer = new JwtTokenService('secret-a');
    const verifier = new JwtTokenService('secret-b');
    const token = signer.signAccessToken('user-123');
    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });

  it('throws when verifying garbage input', () => {
    const service = new JwtTokenService('test-secret');
    expect(() => service.verifyAccessToken('not-a-real-token')).toThrow();
  });
});
