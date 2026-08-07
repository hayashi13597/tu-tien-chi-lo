import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaMaterialRepository } from './PrismaMaterialRepository';
import { PrismaAlchemyRepository } from './PrismaAlchemyRepository';

const prisma = new PrismaClient();
const materials = new PrismaMaterialRepository(prisma);
// Random constant: base 100 → luôn success; 0.5 không < CRIT_CHANCE (0.1) → không crit.
const alchemy = new PrismaAlchemyRepository(prisma, { next: () => 0.5 });

let userId = '';
let characterId = '';
let rankUserId = '';
let rankCharacterId = '';

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
  await prisma.pill.upsert({ where: { id: 'test-dandao-pill' }, create: { id: 'test-dandao-pill', name: 'DD', glyph: 'D', rarity: 1, effectKind: 'linhKhi', amount: 1, desc: 'd', active: true, starterQuantity: 0 }, update: {} });
    await prisma.alchemyRecipe.upsert({
    where: { id: 'test-alchemy-recipe' },
    create: {
      id: 'test-alchemy-recipe', pillId: 'test-alchemy-pill', durationSec: 1_800, linhThachCost: 10, active: true,
      tier: 1, minAlchemyRank: 1, baseSuccessPct: 100,
      ingredients: { create: [{ id: 'test-alchemy-recipe-test-alchemy-material', materialId: 'test-alchemy-material', quantity: 3 }] },
    },
    update: { pillId: 'test-alchemy-pill', durationSec: 1_800, linhThachCost: 10, active: true, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100 },
  });
  const user = await prisma.user.create({ data: { username: `alchemy_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  const character = await prisma.character.create({ data: { userId, linhThach: 50 } });
  characterId = character.id;
  await prisma.materialInventory.create({ data: { userId, materialId: 'test-alchemy-material', quantity: 5 } });
  await prisma.materialInventory.create({ data: { userId, materialId: 'test-alchemy-material-2', quantity: 1 } });
  const rankUser = await prisma.user.create({ data: { username: `alchemy_rank_${Date.now()}`, passwordHash: 'x' } });
  rankUserId = rankUser.id;
  const rankCharacter = await prisma.character.create({ data: { userId: rankUserId, linhThach: 0 } });
  rankCharacterId = rankCharacter.id;
  await prisma.alchemyProfile.create({ data: { userId: rankUserId, characterId: rankCharacterId, danKhi: 100 } });
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: rankUserId } }).catch(() => {});
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

  // Chạy trước test enqueue: lúc này userId chưa từng đụng tới alchemy nên chưa có profile.
  it('getProfile lazy-create rank 1 cho user chưa có profile, gọi lại idempotent', async () => {
    expect(await prisma.alchemyProfile.findUnique({ where: { userId } })).toBeNull();
    const profile = await alchemy.getProfile(userId);
    expect(profile).toMatchObject({ userId, characterId, rank: 1, danKhi: 0, furnaceLevel: 1 });
    const again = await alchemy.getProfile(userId);
    expect(again.id).toBe(profile.id);
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
    // Roll outcome deterministic (random 0.5, base 100): 1 success, 0 fail/crit — counters phải persist.
    const jobRow = await prisma.alchemyJob.findUniqueOrThrow({ where: { id: queued.jobs[0]!.id } });
    expect({ successCount: jobRow.successCount, failCount: jobRow.failCount, critCount: jobRow.critCount }).toEqual({ successCount: 1, failCount: 0, critCount: 0 });

    const repeated = await alchemy.settleCompleted(userId, new Date('2026-07-27T00:30:02Z'));
    expect(repeated.outputGrants).toEqual([]);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { userId_pillId: { userId, pillId: 'test-alchemy-pill' } } })).quantity).toBe(1);
    // tier 1 success = 2 Đan Khí (DAN_KHI_TABLE); settle lặp không cộng double.
    expect((await alchemy.getProfile(userId)).danKhi).toBe(2);
  });

  // Impl rankUp/upgradeFurnace đi kèm Step 2 của plan (guard updateMany atomic) — test viết sau
  // impl theo note của plan, xác nhận hành vi guard + decrement đúng một lần.
  it('rankUp guard atomic: trù count khi sai cấp hoặc thiếu Đan Khí, thành công khi đủ', async () => {
    // targetRank 3 trong khi rank hiện tại 1 → count 0 → throw, không trừ gì.
    await expect(alchemy.rankUp(rankUserId, 3, 300)).rejects.toMatchObject({ code: 'INSUFFICIENT_DAN_KHI' });
    // đúng cấp kế tiếp + đủ 100 Đan Khí → rank 2, decrement đúng 100.
    const profile = await alchemy.rankUp(rankUserId, 2, 100);
    expect(profile).toMatchObject({ rank: 2, danKhi: 0 });
    // hết Đan Khí → guard chặn, rank giữ nguyên, không bị âm.
    await expect(alchemy.rankUp(rankUserId, 3, 300)).rejects.toMatchObject({ code: 'INSUFFICIENT_DAN_KHI' });
    expect(await alchemy.getProfile(rankUserId)).toMatchObject({ rank: 2, danKhi: 0 });
  });
});

describe('settle với buff Đan Đạo (Phase 2)', () => {
  // Recipe base 45, rank 1 + lò 1 → 45%. Random constant 0.5:
  // không buff → 45 < 50 → mẻ hỏng; buff +20 (lv 10 × 2%) → 65 ≥ 50 → thành công.
  it('môn danDao active cộng điểm vào roll; user không môn vẫn hỏng', async () => {
    await prisma.pill.upsert({ where: { id: 'test-dandao-pill' }, create: { id: 'test-dandao-pill', name: 'DD', glyph: 'D', rarity: 1, effectKind: 'linhKhi', amount: 1, desc: 'd', active: true, starterQuantity: 0 }, update: {} });
    await prisma.alchemyRecipe.upsert({
      where: { id: 'test-dandao-recipe' },
      create: {
        id: 'test-dandao-recipe', pillId: 'test-dandao-pill', durationSec: 60, linhThachCost: 0, active: true,
        tier: 1, minAlchemyRank: 1, baseSuccessPct: 45,
        ingredients: { create: [{ id: 'test-dandao-in', materialId: 'test-alchemy-material', quantity: 1 }] },
      },
      update: { baseSuccessPct: 45, active: true, durationSec: 60 },
    });
    await prisma.congPhap.upsert({
      where: { id: 'test-dandao-congphap' },
      create: { id: 'test-dandao-congphap', name: 'Đ', glyph: 'd', rarity: 3, category: 'passive', desc: 'd', active: true, maxLevel: 10, baseCost: 0, costGrowth: 1, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 2 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, tier: 2, branch: 'danDao', minRealmMajor: 3 },
      update: { effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 2 }], active: true },
    });

    const mkUser = async (name: string) => {
      const u = await prisma.user.create({ data: { username: `dd_${name}_${Date.now()}`, passwordHash: 'x' } });
      await prisma.character.create({ data: { userId: u.id, linhThach: 0 } });
      await prisma.materialInventory.create({ data: { userId: u.id, materialId: 'test-alchemy-material', quantity: 2 } });
      return u.id;
    };
    const buffedUser = await mkUser('buffed');
    const plainUser = await mkUser('plain');
    await prisma.ownedCongPhap.create({ data: { userId: buffedUser, congPhapId: 'test-dandao-congphap', level: 10 } });

    const now = new Date('2026-08-07T00:00:00Z');
    await alchemy.enqueue({ userId: buffedUser, characterId: (await prisma.character.findUniqueOrThrow({ where: { userId: buffedUser } })).id, recipeId: 'test-dandao-recipe', quantity: 1, now });
    await alchemy.enqueue({ userId: plainUser, characterId: (await prisma.character.findUniqueOrThrow({ where: { userId: plainUser } })).id, recipeId: 'test-dandao-recipe', quantity: 1, now });

    const later = new Date('2026-08-07T00:10:00Z');
    const settledBuffed = await alchemy.settleCompleted(buffedUser, later);
    const settledPlain = await alchemy.settleCompleted(plainUser, later);

    expect(settledBuffed.jobs[0]).toMatchObject({ successCount: 1, failCount: 0 });
    expect(settledBuffed.outputGrants).toEqual([{ pillId: 'test-dandao-pill', quantity: 1 }]);
    expect(settledPlain.jobs[0]).toMatchObject({ successCount: 0, failCount: 1 });
    expect(settledPlain.outputGrants).toEqual([]);
    // Buff được đọc trong cùng tx settle — không phải state ngoài.

    await prisma.user.deleteMany({ where: { id: { in: [buffedUser, plainUser] } } });
    await prisma.congPhap.delete({ where: { id: 'test-dandao-congphap' } }).catch(() => {});
    await prisma.alchemyRecipe.delete({ where: { id: 'test-dandao-recipe' } }).catch(() => {});
    await prisma.pill.delete({ where: { id: 'test-dandao-pill' } }).catch(() => {});
  });
});
