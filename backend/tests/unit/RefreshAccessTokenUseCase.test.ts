import { describe, it, expect } from 'vitest';
import { RefreshAccessTokenUseCase } from '../../src/application/RefreshAccessTokenUseCase';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('RefreshAccessTokenUseCase', () => {
  it('issues a new access token and a new refresh token for a valid refresh token', () => {
    const tokenService = new FakeTokenService();
    const originalRefreshToken = tokenService.signRefreshToken('user-123');

    const useCase = new RefreshAccessTokenUseCase(tokenService);
    const result = useCase.execute(originalRefreshToken);

    expect(result.token).toBe('access-token-for-user-123');
    expect(result.refreshToken).toBe('refresh-token-for-user-123');
  });

  it('rejects an invalid refresh token with INVALID_REFRESH_TOKEN', () => {
    const useCase = new RefreshAccessTokenUseCase(new FakeTokenService());
    expect(() => useCase.execute('not-a-real-refresh-token')).toThrowError(
      expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    );
  });

  it('rejects an access token presented as a refresh token with INVALID_REFRESH_TOKEN', () => {
    const tokenService = new FakeTokenService();
    const accessToken = tokenService.signAccessToken('user-123');

    const useCase = new RefreshAccessTokenUseCase(tokenService);
    expect(() => useCase.execute(accessToken)).toThrowError(
      expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    );
  });
});
