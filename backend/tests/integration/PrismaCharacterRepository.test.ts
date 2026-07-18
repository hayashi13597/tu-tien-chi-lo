import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaUserRepository } from '../../src/infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from '../../src/infrastructure/repositories/PrismaCharacterRepository';

const users = new PrismaUserRepository(prisma);
const characters = new PrismaCharacterRepository(prisma);

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaCharacterRepository', () => {
  it('finds a character by userId', async () => {
    const user = await users.create({ username: 'bob', passwordHash: 'hashed' });
    const found = await characters.findByUserId(user.id);
    expect(found?.userId).toBe(user.id);
  });

  it('returns null for a userId with no character', async () => {
    expect(await characters.findByUserId('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('updates the row when expectedLastUpdateAt matches', async () => {
    const user = await users.create({ username: 'carol', passwordHash: 'hashed' });
    const character = await characters.findByUserId(user.id);

    const updated = await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 1,
      linhKhi: 42,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
      cultivationBuffMultiplier: null,
      cultivationBuffUntil: null,
      breakthroughBonusPct: 0,
    });

    expect(updated?.realmSub).toBe(1);
    expect(updated?.linhKhi).toBe(42);
  });

  it('returns null and does not write when expectedLastUpdateAt is stale (concurrent modification)', async () => {
    const user = await users.create({ username: 'dave', passwordHash: 'hashed' });
    const character = await characters.findByUserId(user.id);

    // First writer succeeds.
    await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 1,
      linhKhi: 10,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
      cultivationBuffMultiplier: null,
      cultivationBuffUntil: null,
      breakthroughBonusPct: 0,
    });

    // Second writer still has the stale lastUpdateAt read before the first write.
    const staleResult = await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 2,
      linhKhi: 999,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
      cultivationBuffMultiplier: null,
      cultivationBuffUntil: null,
      breakthroughBonusPct: 0,
    });

    expect(staleResult).toBeNull();
    const current = await characters.findByUserId(user.id);
    expect(current?.realmSub).toBe(1); // first writer's value stands
    expect(current?.linhKhi).toBe(10);
  });
});
