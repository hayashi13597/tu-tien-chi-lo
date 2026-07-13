import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../src/application/LoginUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('LoginUserUseCase', () => {
  it('returns an access token and a refresh token for valid credentials', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();
    const registered = await new RegisterUserUseCase(users, passwordHasher, tokenService).execute({
      username: 'dave',
      password: 'password123',
    });

    const useCase = new LoginUserUseCase(users, passwordHasher, tokenService);
    const result = await useCase.execute({ username: 'dave', password: 'password123' });

    expect(result.token).toBe(`access-token-for-${registered.id}`);
    expect(result.refreshToken).toBe(`refresh-token-for-${registered.id}`);
  });

  it('rejects an unknown username with INVALID_CREDENTIALS', async () => {
    const useCase = new LoginUserUseCase(new InMemoryUserRepository(), new FakePasswordHasher(), new FakeTokenService());
    await expect(useCase.execute({ username: 'nobody', password: 'whatever1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();
    await new RegisterUserUseCase(users, passwordHasher, tokenService).execute({
      username: 'erin',
      password: 'password123',
    });

    const useCase = new LoginUserUseCase(users, passwordHasher, tokenService);
    await expect(useCase.execute({ username: 'erin', password: 'wrongpass1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
