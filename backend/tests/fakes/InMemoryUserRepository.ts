import { UserRepository } from '../../src/domain/ports/UserRepository';
import { UserRecord } from '../../src/domain/entities/User';

export class InMemoryUserRepository implements UserRepository {
  private usersById = new Map<string, UserRecord>();
  private nextId = 1;

  async findByUsername(username: string): Promise<UserRecord | null> {
    for (const user of this.usersById.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      username: input.username,
      passwordHash: input.passwordHash,
      role: 'user',
      createdAt: new Date(),
    };
    this.usersById.set(user.id, user);
    return user;
  }

  /** Test helper — not part of the port — to promote a seeded user. */
  setRole(id: string, role: string): void {
    const user = this.usersById.get(id);
    if (user) this.usersById.set(id, { ...user, role });
  }
}
