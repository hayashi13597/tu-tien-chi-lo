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

  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      username: input.username,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };
    this.usersById.set(user.id, user);
    return user;
  }
}
