import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaMaterialRepository } from './PrismaMaterialRepository';
import { PrismaAlchemyRepository } from './PrismaAlchemyRepository';

const prisma = new PrismaClient();
const materials = new PrismaMaterialRepository(prisma);
const alchemy = new PrismaAlchemyRepository(prisma);

let userId = '';
let characterId = '';

beforeAll(async () => {
  await prisma.pill.upsert({
    where: { id: 'hoi-khi-dan' },
    create: { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', amount: 50, desc: 'd', active: true, starterQuantity: 0 },
    update: {},
  });
  await prisma.pill.upsert({
    where: { id: 'test-alchemy-pill' },
    create: { id: 'test-alchemy-pill', name: 'Test Pill', glyph: 'T', rarity: 1, effectKind: 'linhKhi', amount: 1, desc: 'd', active: true, starterQuantity: 0 },
    update: {},
  });
  await prisma.material.upsert({
    where: { id: 'test-alchemy-material' },
    create: { id: 'test-alchemy-material', name: 'Test', glyph: 'T', rarity: 1, description: 'd', active: true },
    update: {},
  });
  await prisma.material.upsert({
    where: { id: 'test-alchemy-material-2' },
    create: { id: 'test-alchemy-material-2', name: 'Test 2', glyph: 'T2', rarity: 1, description: 'd', active: true },
    update: {},
  });
  await prisma.alchemyRecipe.upsert({
    where: { id: 'test-alchemy-recipe' },
    create: {
      id: 'test-alchemy-recipe', pillId: 'test-alchemy-pill', durationSec: 1_800, linhThachCost: 10, active: true,
      ingredients: { create: [{ id: 'test-alchemy-recipe-test-alchemy-material', materialId: 'test-alchemy-material', quantity: 3 }] },
    },
    update: { pillId: 'test-alchemy-pill', durationSec: 1_800, linhThachCost: 10, active: true },
  });
  const user = await prisma.user.create({ data: { username: `alchemy_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  const character = await prisma.character.create({ data: { userId, linhThach: 50 } });
  characterId = character.id;
  await prisma.materialInventory.create({ data: { userId, materialId: 'test-alchemy-material', quantity: 5 } });
  await prisma.materialInventory.create({ data: { userId, materialId: 'test-alchemy-material-2', quantity: 1 } });
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.alchemyRecipe.delete({ where: { id: 'test-alchemy-recipe' } }).catch(() => {});
  await prisma.pill.delete({ where: { id: 'test-alchemy-pill' } }).catch(() => {});
  await prisma.material.deleteMany({ where: { id: { in: ['test-alchemy-material', 'test-alchemy-material-2'] } } });
  await prisma.$disconnect();
});

describe('material/alchemy Prisma repositories', () => {
  it('spendMany rollback toàn bộ nếu một material không đủ', async () => {
    expect(await materials.spendMany(userId, [
      { materialId: 'test-alchemy-material', quantity: 3 },
      { materialId: 'test-alchemy-material-2', quantity: 2 },
    ])).toBe(false);
    const rows = await prisma.materialInventory.findMany({ where: { userId }, orderBy: { materialId: 'asc' } });
    expect(rows.map((row) => row.quantity)).toEqual([5, 1]);
  });

  it('enqueue trừ material và Linh Thạch trong transaction, settle grant Pill idempotent', async () => {
    const now = new Date('2026-07-27T00:00:00Z');
    const queued = await alchemy.enqueue({ userId, characterId, recipeId: 'test-alchemy-recipe', quantity: 1, now });
    expect(queued.jobs[0]?.status).toBe('running');
    expect((await prisma.character.findUniqueOrThrow({ where: { id: characterId } })).linhThach).toBe(40);
    expect((await prisma.materialInventory.findUniqueOrThrow({ where: { userId_materialId: { userId, materialId: 'test-alchemy-material' } } })).quantity).toBe(2);

    const settled = await alchemy.settleCompleted(userId, new Date('2026-07-27T00:30:01Z'));
    expect(settled.outputGrants).toEqual([{ pillId: 'test-alchemy-pill', quantity: 1 }]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { userId_pillId: { userId, pillId: 'test-alchemy-pill' } } })).quantity).toBe(1);

    const repeated = await alchemy.settleCompleted(userId, new Date('2026-07-27T00:30:02Z'));
    expect(repeated.outputGrants).toEqual([]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { userId_pillId: { userId, pillId: 'test-alchemy-pill' } } })).quantity).toBe(1);
  });
});
