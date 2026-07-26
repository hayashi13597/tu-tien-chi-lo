import { AdminUserEntry, AdminUserRepository } from '../domain/ports/AdminUserRepository';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class SearchUsersUseCase {
  constructor(private readonly users: AdminUserRepository) {}

  async execute(input: { q?: string; limit?: number }): Promise<AdminUserEntry[]> {
    // Clamp ở đây (không ở route) để mọi caller đều chịu cùng trần: một `limit`
    // khổng lồ sẽ kéo cả bảng User về cho admin UI.
    const requested = input.limit;
    const limit = Number.isInteger(requested)
      ? Math.min(Math.max(requested as number, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    return this.users.search((input.q ?? '').trim(), limit);
  }
}
