import { describe, it, expect } from 'vitest';
import { JwtTokenService } from '../../src/infrastructure/auth/JwtTokenService';

describe('JwtTokenService', () => {
  describe('access tokens', () => {
    it('signs a token that verifies back to the same userId', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signAccessToken('user-123');
      expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123' });
    });

    it('throws when verifying an access token signed with a different access secret', () => {
      const signer = new JwtTokenService('access-secret-a', 'refresh-secret');
      const verifier = new JwtTokenService('access-secret-b', 'refresh-secret');
      const token = signer.signAccessToken('user-123');
      expect(() => verifier.verifyAccessToken(token)).toThrow();
    });

    it('throws when verifying garbage input as an access token', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      expect(() => service.verifyAccessToken('not-a-real-token')).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('signs a refresh token that verifies back to the same userId', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signRefreshToken('user-123');
      expect(service.verifyRefreshToken(token)).toEqual({ userId: 'user-123' });
    });

    it('throws when verifying a refresh token signed with a different refresh secret', () => {
      const signer = new JwtTokenService('access-secret', 'refresh-secret-a');
      const verifier = new JwtTokenService('access-secret', 'refresh-secret-b');
      const token = signer.signRefreshToken('user-123');
      expect(() => verifier.verifyRefreshToken(token)).toThrow();
    });
  });

  describe('secret isolation between token kinds', () => {
    it('rejects a refresh token presented to verifyAccessToken when secrets differ', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const refreshToken = service.signRefreshToken('user-123');
      expect(() => service.verifyAccessToken(refreshToken)).toThrow();
    });

    it('rejects an access token presented to verifyRefreshToken when secrets differ', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const accessToken = service.signAccessToken('user-123');
      expect(() => service.verifyRefreshToken(accessToken)).toThrow();
    });
  });

  describe('access token expiry', () => {
    it('signs an access token with a 15-minute expiry', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signAccessToken('user-123');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('signs a refresh token with a 7-day expiry', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signRefreshToken('user-123');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    });
  });
});
