import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaUserRepository } from '../../src/infrastructure/repositories/PrismaUserRepository';

const repository = new PrismaUserRepository(prisma);

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
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

  it('starts a new user at tokenVersion 0 and increments it atomically', async () => {
    const created = await repository.create({ username: 'alice', passwordHash: 'hashed' });
    expect(created.tokenVersion).toBe(0);

    const afterFirst = await repository.incrementTokenVersion(created.id);
    expect(afterFirst).toBe(1);
    const afterSecond = await repository.incrementTokenVersion(created.id);
    expect(afterSecond).toBe(2);

    const reread = await repository.findById(created.id);
    expect(reread?.tokenVersion).toBe(2);
  });
});
