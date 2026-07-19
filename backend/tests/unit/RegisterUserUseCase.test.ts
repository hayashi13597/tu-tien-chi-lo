import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';

describe('RegisterUserUseCase', () => {
  it('creates a user and returns id, username, and both tokens', async () => {
    const useCase = new RegisterUserUseCase(
      new InMemoryUserRepository(),
      new FakePasswordHasher(),
      new FakeTokenService(),
      new InMemoryPillRepository(),
    );
    const result = await useCase.execute({ username: 'alice', password: 'password123' });

    expect(result.username).toBe('alice');
    expect(typeof result.id).toBe('string');
    expect(result.accessToken).toBe(`access-token-for-user:${result.id}`);
    expect(result.refreshToken).toBe(`refresh-token-for-${result.id}`);
  });

  it('rejects a duplicate username with USERNAME_TAKEN', async () => {
    const users = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(users, new FakePasswordHasher(), new FakeTokenService(), new InMemoryPillRepository());
    await useCase.execute({ username: 'bob', password: 'password123' });

    await expect(useCase.execute({ username: 'bob', password: 'password456' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });

  it('seeds starter inventory for the new user', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedStarterDefinitions();
    const useCase = new RegisterUserUseCase(
      new InMemoryUserRepository(),
      new FakePasswordHasher(),
      new FakeTokenService(),
      pills,
    );
    const result = await useCase.execute({ username: 'carol', password: 'password123' });

    const inv = await pills.listInventory(result.id);
    expect(inv.length).toBe(8);
  });
});
