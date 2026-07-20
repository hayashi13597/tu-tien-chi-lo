import { describe, it, expect } from 'vitest';
import { LogoutUseCase } from '../../src/application/LogoutUseCase';
import { FakeTokenService } from '../fakes/FakeTokenService';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';

describe('LogoutUseCase', () => {
  it('bumps the user tokenVersion when a valid refresh token is presented', async () => {
    const tokenService = new FakeTokenService();
    const users = new InMemoryUserRepository();
    const created = await users.create({ username: 'u', passwordHash: 'h' });
    const refreshToken = tokenService.signRefreshToken(created.id, created.tokenVersion);

    await new LogoutUseCase(tokenService, users).execute(refreshToken);

    const reread = await users.findById(created.id);
    expect(reread?.tokenVersion).toBe(1);
  });

  it('is a no-op (no throw, no bump) when no refresh token is given', async () => {
    const users = new InMemoryUserRepository();
    const created = await users.create({ username: 'u', passwordHash: 'h' });

    await expect(new LogoutUseCase(new FakeTokenService(), users).execute(undefined)).resolves.toBeUndefined();

    const reread = await users.findById(created.id);
    expect(reread?.tokenVersion).toBe(0);
  });

  it('swallows an invalid refresh token without throwing', async () => {
    const users = new InMemoryUserRepository();
    await expect(
      new LogoutUseCase(new FakeTokenService(), users).execute('garbage-token'),
    ).resolves.toBeUndefined();
  });
});
