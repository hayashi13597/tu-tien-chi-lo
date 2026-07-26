import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaCongPhapRepository } from './PrismaCongPhapRepository';
import { PrismaOwnedCongPhapRepository } from './PrismaOwnedCongPhapRepository';
import { PrismaCharacterRepository } from './PrismaCharacterRepository';

const prisma = new PrismaClient();
const congphap = new PrismaCongPhapRepository(prisma);
const owned = new PrismaOwnedCongPhapRepository(prisma);
const characters = new PrismaCharacterRepository(prisma);

let userId = '';
let charId = '';

beforeAll(async () => {
  await prisma.congPhap.upsert({
    where: { id: 'test-passive' },
    create: { id: 'test-passive', name: 'T', glyph: 't', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null },
    update: {},
  });
  const user = await prisma.user.create({ data: { username: `cp_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  const c = await prisma.character.create({ data: { userId, linhThach: 500 } });
  charId = c.id;
});

afterAll(async () => {
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
  it('setSlot/clearSlot/unsetSlot', async () => {
    expect(await owned.setSlot(userId, 'test-passive', 0)).toBe(true);
    await owned.clearSlot(userId, 0);
    expect((await owned.getOne(userId, 'test-passive'))?.equippedSlot).toBeNull();
  });
});
