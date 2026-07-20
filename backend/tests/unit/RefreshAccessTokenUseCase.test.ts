import { describe, it, expect } from 'vitest';
import { RefreshAccessTokenUseCase } from '../../src/application/RefreshAccessTokenUseCase';
import { FakeTokenService } from '../fakes/FakeTokenService';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';

describe('RefreshAccessTokenUseCase', () => {
  it('issues a new access token and a new refresh token for a valid refresh token', async () => {
    const tokenService = new FakeTokenService();
    const users = new InMemoryUserRepository();
    const created = await users.create({ username: 'u', passwordHash: 'h' }); // id "user-1"
    const originalRefreshToken = tokenService.signRefreshToken(created.id, created.tokenVersion);

    const useCase = new RefreshAccessTokenUseCase(tokenService, users);
    const result = await useCase.execute(originalRefreshToken);

    expect(result.token).toBe(`access-token-for-user:${created.id}`);
    expect(result.refreshToken).toBe(`refresh-token-for-${created.id}:v0`);
  });

  it('mints the refreshed access token with the user current role', async () => {
    const tokenService = new FakeTokenService();
    const users = new InMemoryUserRepository();
    const created = await users.create({ username: 'admin', passwordHash: 'h' });
    users.setRole(created.id, 'admin');
    const refreshToken = tokenService.signRefreshToken(created.id, created.tokenVersion);

    const useCase = new RefreshAccessTokenUseCase(tokenService, users);
    const result = await useCase.execute(refreshToken);

    expect(result.token).toBe(`access-token-for-admin:${created.id}`);
  });

  it('rejects a refresh token whose tokenVersion is stale after a logout bumped it', async () => {
    const tokenService = new FakeTokenService();
    const users = new InMemoryUserRepository();
    const created = await users.create({ username: 'u', passwordHash: 'h' });
    // Token signed at version 0 (the value at sign time)...
    const staleRefreshToken = tokenService.signRefreshToken(created.id, created.tokenVersion);
    // ...then a logout-everywhere bumps the stored version to 1.
    await users.incrementTokenVersion(created.id);

    const useCase = new RefreshAccessTokenUseCase(tokenService, users);
    await expect(useCase.execute(staleRefreshToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('rejects an invalid refresh token with INVALID_REFRESH_TOKEN', async () => {
    const useCase = new RefreshAccessTokenUseCase(new FakeTokenService(), new InMemoryUserRepository());
    await expect(useCase.execute('not-a-real-refresh-token')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('rejects an access token presented as a refresh token with INVALID_REFRESH_TOKEN', async () => {
    const tokenService = new FakeTokenService();
    const accessToken = tokenService.signAccessToken('user-123', 'user');

    const useCase = new RefreshAccessTokenUseCase(tokenService, new InMemoryUserRepository());
    await expect(useCase.execute(accessToken)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });
});
