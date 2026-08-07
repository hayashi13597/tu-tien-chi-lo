import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Prisma schema', () => {
  it('creates a user with a linked character using default values', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'schema-test-user',
        passwordHash: 'hashed',
        character: {
          create: {},
        },
      },
      include: { character: true },
    });

    expect(user.character?.realmMajor).toBe(0);
    expect(user.character?.realmSub).toBe(0);
    expect(user.character?.linhKhi).toBe(0);
    expect(user.character?.punishedUntil).toBeNull();
  });

  it('creates an alchemy profile with rank 1 defaults', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'schema-alchemy-user',
        passwordHash: 'hashed',
        character: { create: {} },
      },
      include: { character: true },
    });
    const profile = await prisma.alchemyProfile.create({
      data: { userId: user.id, characterId: user.character!.id },
    });
    expect(profile.rank).toBe(1);
    expect(profile.danKhi).toBe(0);
    expect(profile.furnaceLevel).toBe(1);
  });
});
