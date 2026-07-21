import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('redeem schema', () => {
  beforeEach(async () => {
    await prisma.redemption.deleteMany();
    await prisma.redeemCodeReward.deleteMany();
    await prisma.redeemCode.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
  });

  afterAll(async () => {
    await prisma.redemption.deleteMany();
    await prisma.redeemCodeReward.deleteMany();
    await prisma.redeemCode.deleteMany();
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
    await prisma.$disconnect();
  });

  it('creates a code with a reward and a redemption, enforcing per-user uniqueness', async () => {
    await prisma.pill.create({ data: { id: 'test-p', name: 'P', glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, desc: 'd', active: true, starterQuantity: 0 } });
    const user = await prisma.user.create({ data: { username: 'zoe-redeem', passwordHash: 'h' } });
    const code = await prisma.redeemCode.create({
      data: { code: 'TEST2026', active: true, maxRedemptions: 5, rewards: { create: [{ pillId: 'test-p', quantity: 3 }] } },
      include: { rewards: true },
    });
    expect(code.redeemedCount).toBe(0);
    expect(code.rewards[0].quantity).toBe(3);

    await prisma.redemption.create({ data: { codeId: code.id, userId: user.id } });
    await expect(
      prisma.redemption.create({ data: { codeId: code.id, userId: user.id } }),
    ).rejects.toThrow();
  });
});
