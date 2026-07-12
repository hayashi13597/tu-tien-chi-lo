import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaUserRepository } from '../../src/infrastructure/repositories/PrismaUserRepository';

const repository = new PrismaUserRepository(prisma);

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaUserRepository', () => {
  it('creates a user with a default character and finds it by username', async () => {
    const created = await repository.create({ username: 'alice', passwordHash: 'hashed' });
    expect(created.username).toBe('alice');

    const found = await repository.findByUsername('alice');
    expect(found?.id).toBe(created.id);

    const character = await prisma.character.findUnique({ where: { userId: created.id } });
    expect(character?.realmMajor).toBe(0);
    expect(character?.realmSub).toBe(0);
    expect(character?.linhKhi).toBe(0);
  });

  it('returns null for an unknown username', async () => {
    expect(await repository.findByUsername('nobody')).toBeNull();
  });
});
