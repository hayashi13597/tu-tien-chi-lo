import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaCongPhapRepository } from './PrismaCongPhapRepository';
import { PrismaOwnedCongPhapRepository } from './PrismaOwnedCongPhapRepository';
import { PrismaCharacterRepository } from './PrismaCharacterRepository';
import { PrismaProgressionRepository } from './PrismaProgressionRepository';

const prisma = new PrismaClient();
const congphap = new PrismaCongPhapRepository(prisma);
const owned = new PrismaOwnedCongPhapRepository(prisma);
const characters = new PrismaCharacterRepository(prisma);
const progression = new PrismaProgressionRepository(prisma);

let userId = '';
let charId = '';

beforeAll(async () => {
  await prisma.congPhap.upsert({
    where: { id: 'test-passive' },
    create: { id: 'test-passive', name: 'T', glyph: 't', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null },
    update: {},
  });
  await prisma.material.upsert({
    where: { id: 'test-progression-material' },
    create: { id: 'test-progression-material', name: 'Progression Test', glyph: 'P', rarity: 1, description: 'd', active: true },
    update: {},
  });
  await prisma.congPhap.upsert({
    where: { id: 'test-progression' },
    create: {
      id: 'test-progression', name: 'Progression', glyph: 'p', rarity: 1, category: 'passive', desc: 'd', active: true,
      maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 1, pctPerLevel: 0 }],
      powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
      upgradeMaterialId: 'test-progression-material', baseMaterialCost: 1, materialCostGrowth: 1, cooldownRounds: null,
    },
    update: { upgradeMaterialId: 'test-progression-material', baseMaterialCost: 1, materialCostGrowth: 1 },
  });
  const user = await prisma.user.create({ data: { username: `cp_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  const c = await prisma.character.create({ data: { userId, linhThach: 500 } });
  charId = c.id;
});

afterAll(async () => {
  await prisma.congPhap.updateMany({ where: { id: 'test-passive' }, data: { upgradeMaterialId: null } });
  await prisma.material.deleteMany({ where: { id: 'test-material-upgrade' } });
  await prisma.ownedCongPhap.deleteMany({ where: { congPhapId: 'test-progression' } });
  await prisma.congPhap.delete({ where: { id: 'test-progression' } }).catch(() => {});
  await prisma.material.delete({ where: { id: 'test-progression-material' } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

describe('OwnedCongPhap + Linh Thạch', () => {
  it('grant tạo bản sở hữu, grant lần 2 trả false', async () => {
    expect(await owned.grant(userId, 'test-passive')).toBe(true);
    expect(await owned.grant(userId, 'test-passive')).toBe(false);
  });
  it('effects round-trip đúng JSON', async () => {
    const one = await owned.getOne(userId, 'test-passive');
    expect(one?.def.effects?.[0].attribute).toBe('khiHuyet');
  });
  it('levelUpGuarded chỉ +1 khi level khớp', async () => {
    expect(await owned.levelUpGuarded(userId, 'test-passive', 1)).toBe(true);
    expect(await owned.levelUpGuarded(userId, 'test-passive', 1)).toBe(false); // giờ level=2
  });
  it('spendLinhThach guard số dư', async () => {
    expect(await characters.spendLinhThach(charId, 400)).toBe(true);   // 500->100
    expect(await characters.spendLinhThach(charId, 400)).toBe(false);  // không đủ
    await characters.addLinhThach(charId, 400);                        // 100->500
  });

  it('levelUpWithCosts rollback khi thiếu material và chống double spend khi race', async () => {
    await prisma.ownedCongPhap.upsert({
      where: { userId_congPhapId: { userId, congPhapId: 'test-progression' } },
      create: { userId, congPhapId: 'test-progression', level: 1 },
      update: { level: 1 },
    });
    await prisma.materialInventory.upsert({
      where: { userId_materialId: { userId, materialId: 'test-progression-material' } },
      create: { userId, materialId: 'test-progression-material', quantity: 0 },
      update: { quantity: 0 },
    });
    await prisma.character.update({ where: { id: charId }, data: { linhThach: 100 } });

    const insufficient = await progression.levelUpWithCosts({ userId, congPhapId: 'test-progression', expectedLevel: 1, linhThachCost: 100, materialId: 'test-progression-material', materialCost: 1 });
    expect(insufficient).toEqual({ kind: 'insufficient-materials' });
    expect((await prisma.character.findUniqueOrThrow({ where: { id: charId } })).linhThach).toBe(100);

    await prisma.materialInventory.update({ where: { userId_materialId: { userId, materialId: 'test-progression-material' } }, data: { quantity: 2 } });
    const results = await Promise.all([
      progression.levelUpWithCosts({ userId, congPhapId: 'test-progression', expectedLevel: 1, linhThachCost: 100, materialId: 'test-progression-material', materialCost: 1 }),
      progression.levelUpWithCosts({ userId, congPhapId: 'test-progression', expectedLevel: 1, linhThachCost: 100, materialId: 'test-progression-material', materialCost: 1 }),
    ]);
    expect(results.filter((result) => result.kind === 'updated')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'concurrent')).toHaveLength(1);
    expect((await prisma.character.findUniqueOrThrow({ where: { id: charId } })).linhThach).toBe(0);
    expect((await prisma.materialInventory.findUniqueOrThrow({ where: { userId_materialId: { userId, materialId: 'test-progression-material' } } })).quantity).toBe(1);
  });
  it('setSlot/clearSlot/unsetSlot', async () => {
    expect(await owned.setSlot(userId, 'test-passive', 0)).toBe(true);
    await owned.clearSlot(userId, 0);
    expect((await owned.getOne(userId, 'test-passive'))?.equippedSlot).toBeNull();
  });

  it('round-trip được material upgrade trên CongPhap', async () => {
    await prisma.material.upsert({
      where: { id: 'test-material-upgrade' },
      create: { id: 'test-material-upgrade', name: 'Test', glyph: 'T', rarity: 1, description: 'd', active: true },
      update: {},
    });
    await prisma.congPhap.update({
      where: { id: 'test-passive' },
      data: {
        upgradeMaterialId: 'test-material-upgrade',
        baseMaterialCost: 2,
        materialCostGrowth: 1.5,
      },
    });

    const entry = await owned.getOne(userId, 'test-passive');
    expect(entry?.def.upgradeMaterialId).toBe('test-material-upgrade');
    expect(entry?.def.baseMaterialCost).toBe(2);
  });
});
