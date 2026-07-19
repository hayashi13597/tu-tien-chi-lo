import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../domain/ports/UserRepository';
import { UserRecord } from '../../domain/entities/User';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { username } });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { id } });
  }

  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    // Nested create makes User + its default Character one atomic write,
    // matching spec section 7 ("register creates User + Character mặc định").
    return this.client.user.create({
      data: {
        username: input.username,
        passwordHash: input.passwordHash,
        character: { create: {} },
      },
    });
  }
}
