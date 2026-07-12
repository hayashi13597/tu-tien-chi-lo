import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../src/application/LoginUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('LoginUserUseCase', () => {
  it('returns a token for valid credentials', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    await new RegisterUserUseCase(users, passwordHasher).execute({ username: 'dave', password: 'password123' });

    const useCase = new LoginUserUseCase(users, passwordHasher, new FakeTokenService());
    const result = await useCase.execute({ username: 'dave', password: 'password123' });
    expect(result.token).toBe('token-for-user-1');
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
    await new RegisterUserUseCase(users, passwordHasher).execute({ username: 'erin', password: 'password123' });

    const useCase = new LoginUserUseCase(users, passwordHasher, new FakeTokenService());
    await expect(useCase.execute({ username: 'erin', password: 'wrongpass1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
