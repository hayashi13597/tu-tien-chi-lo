import { describe, it, expect } from 'vitest';
import { SearchUsersUseCase } from './SearchUsersUseCase';
import { AdminUserEntry } from '../domain/ports/AdminUserRepository';

// Fake repo that records what the use case actually asked for.
function fake() {
  const calls: { query: string; limit: number }[] = [];
  const repo = {
    search: async (query: string, limit: number): Promise<AdminUserEntry[]> => {
      calls.push({ query, limit });
      return [];
    },
  };
  return { repo, calls };
}

describe('SearchUsersUseCase', () => {
  it('mặc định limit 20 và query rỗng', async () => {
    const f = fake();
    await new SearchUsersUseCase(f.repo).execute({});
    expect(f.calls[0]).toEqual({ query: '', limit: 20 });
  });

  it('trim query', async () => {
    const f = fake();
    await new SearchUsersUseCase(f.repo).execute({ q: '  alice  ' });
    expect(f.calls[0].query).toBe('alice');
  });

  it('clamp limit vào [1, 50]', async () => {
    const f = fake();
    const uc = new SearchUsersUseCase(f.repo);
    await uc.execute({ limit: 999 });
    await uc.execute({ limit: 0 });
    await uc.execute({ limit: 7 });
    expect(f.calls.map((c) => c.limit)).toEqual([50, 1, 7]);
  });

  it('limit không phải số nguyên thì dùng mặc định', async () => {
    const f = fake();
    await new SearchUsersUseCase(f.repo).execute({ limit: Number.NaN });
    expect(f.calls[0].limit).toBe(20);
  });
});
