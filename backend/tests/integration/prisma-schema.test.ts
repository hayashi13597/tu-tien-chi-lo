import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';

beforeEach(async () => {
  // Scoped cleanup for the catalog rows this file creates — deleting all
  // pills/materials would wipe the shared seeded catalog other files rely on.
  await prisma.alchemyJob.deleteMany({ where: { recipeId: 'schema-recipe' } });
  await prisma.alchemyRecipe.deleteMany({ where: { id: 'schema-recipe' } });
  await prisma.pill.deleteMany({ where: { id: 'schema-pill' } });
  await prisma.material.deleteMany({ where: { id: 'schema-material' } });
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Don't leak catalog rows into other files (e.g. /alchemy/recipes asserts
  // the seeded count of exactly 8).
  await prisma.alchemyJob.deleteMany({ where: { recipeId: 'schema-recipe' } });
  await prisma.alchemyRecipe.deleteMany({ where: { id: 'schema-recipe' } });
  await prisma.pill.deleteMany({ where: { id: 'schema-pill' } });
  await prisma.material.deleteMany({ where: { id: 'schema-material' } });
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

  it('creates alchemy profile, recipe and job rows with schema defaults', async () => {
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

    // Catalog rows created without the new Luyện Đan 2.0 columns pick up
    // their schema defaults.
    const material = await prisma.material.create({
      data: { id: 'schema-material', name: 'M', glyph: 'm', rarity: 0, description: 'd' },
    });
    expect(material.tier).toBe(1);

    const pill = await prisma.pill.create({
      data: { id: 'schema-pill', name: 'P', glyph: 'p', rarity: 0, effectKind: 'linhKhi', desc: 'd' },
    });
    expect(pill.tier).toBe(1);

    const recipe = await prisma.alchemyRecipe.create({
      data: { id: 'schema-recipe', pillId: pill.id, durationSec: 60, linhThachCost: 10 },
    });
    expect(recipe.tier).toBe(1);
    expect(recipe.minAlchemyRank).toBe(1);
    expect(recipe.baseSuccessPct).toBe(100);
    expect(recipe.active).toBe(true);

    const job = await prisma.alchemyJob.create({
      data: {
        userId: user.id,
        characterId: user.character!.id,
        recipeId: recipe.id,
        quantity: 2,
        queuedAt: new Date(),
        startsAt: new Date(),
        completesAt: new Date(),
      },
    });
    expect(job.status).toBe('queued');
    expect(job.successCount).toBe(0);
    expect(job.failCount).toBe(0);
    expect(job.critCount).toBe(0);
  });
});
