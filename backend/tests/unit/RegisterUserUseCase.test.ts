import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';

describe('RegisterUserUseCase', () => {
  it('creates a user and returns id + username', async () => {
    const useCase = new RegisterUserUseCase(new InMemoryUserRepository(), new FakePasswordHasher());
    const result = await useCase.execute({ username: 'alice', password: 'password123' });
    expect(result.username).toBe('alice');
    expect(typeof result.id).toBe('string');
  });

  it('rejects a duplicate username with USERNAME_TAKEN', async () => {
    const users = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(users, new FakePasswordHasher());
    await useCase.execute({ username: 'bob', password: 'password123' });

    await expect(useCase.execute({ username: 'bob', password: 'password456' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
});
