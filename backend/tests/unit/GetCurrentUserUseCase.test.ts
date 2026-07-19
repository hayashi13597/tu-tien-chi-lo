import { describe, it, expect } from 'vitest';
import { GetCurrentUserUseCase } from '../../src/application/GetCurrentUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { DomainError } from '../../src/domain/errors';

describe('GetCurrentUserUseCase', () => {
  it('returns id, username, and the role carried by the token', async () => {
    const users = new InMemoryUserRepository();
    const user = await users.create({ username: 'alice', passwordHash: 'x' });
    const useCase = new GetCurrentUserUseCase(users);

    const result = await useCase.execute({ userId: user.id, role: 'admin' });

    expect(result).toEqual({ id: user.id, username: 'alice', role: 'admin' });
  });

  it('throws USER_NOT_FOUND when the user no longer exists', async () => {
    const useCase = new GetCurrentUserUseCase(new InMemoryUserRepository());

    await expect(useCase.execute({ userId: 'ghost', role: 'user' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    await expect(useCase.execute({ userId: 'ghost', role: 'user' })).rejects.toBeInstanceOf(DomainError);
  });
});
