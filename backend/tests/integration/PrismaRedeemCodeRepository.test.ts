import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaRedeemCodeRepository } from '../../src/infrastructure/repositories/PrismaRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

const repo = new PrismaRedeemCodeRepository(prisma);

async function seedPill(id: string) {
  await prisma.pill.upsert({ where: { id }, update: {}, create: { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, desc: 'd', active: true, starterQuantity: 0 } });
}
async function seedUser(username: string) {
  return prisma.user.create({ data: { username, passwordHash: 'h' } });
}
function codeRecord(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'rc-test-1', code: 'PRISMTEST', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'test-redeem-p', quantity: 3 }], ...over };
}

beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'PRISM' } } });
  await prisma.inventoryItem.deleteMany({ where: { user: { username: { startsWith: 'rc-user-' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'rc-user-' } } });
});

afterAll(async () => {
  // Drop everything that references the test pill (FK order: redemptions/rewards/
  // codes and inventory) before the pill itself.
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'PRISM' } } });
  await prisma.inventoryItem.deleteMany({ where: { pillId: { startsWith: 'test-redeem-' } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'rc-user-' } } });
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-redeem-' } } });
  await prisma.$disconnect();
});

describe('PrismaRedeemCodeRepository', () => {
  it('create + findByCode round-trip', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const found = await repo.findByCode('PRISMTEST');
    expect(found?.id).toBe('rc-test-1');
    expect(found?.rewards[0].quantity).toBe(3);
  });

  it('listAll includes inactive', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ id: 'rc-test-2', code: 'PRISMTEST2', active: false }));
    const all = await repo.listAll();
    expect(all.find((c) => c.id === 'rc-test-2')?.active).toBe(false);
  });

  it('update replaces scalar fields and rewards wholesale', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const ok = await repo.update({ ...codeRecord(), maxRedemptions: 99, rewards: [] });
    expect(ok).toBe(true);
    const updated = await repo.findByCode('PRISMTEST');
    expect(updated?.maxRedemptions).toBe(99);
    expect(updated?.rewards).toHaveLength(0);
  });

  it('update returns false for unknown id', async () => {
    const ok = await repo.update({ ...codeRecord(), id: 'no-such-id' });
    expect(ok).toBe(false);
  });

  it('tryReserveRedemption: ok → already_redeemed for same user', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const u = await seedUser('rc-user-a');
    expect(await repo.tryReserveRedemption('rc-test-1', u.id, 2)).toBe('ok');
    expect(await repo.tryReserveRedemption('rc-test-1', u.id, 2)).toBe('already_redeemed');
  });

  it('tryReserveRedemption: exhausted when cap reached', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ maxRedemptions: 1 }));
    const u1 = await seedUser('rc-user-b');
    const u2 = await seedUser('rc-user-c');
    expect(await repo.tryReserveRedemption('rc-test-1', u1.id, 1)).toBe('ok');
    expect(await repo.tryReserveRedemption('rc-test-1', u2.id, 1)).toBe('exhausted');
  });

  it('concurrent double-redeem: exactly one ok and one exhausted (race test)', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ id: 'rc-test-race', code: 'PRISMRACE', maxRedemptions: 1 }));
    const u1 = await seedUser('rc-user-race1');
    const u2 = await seedUser('rc-user-race2');
    // Pre-warm connections like breakthrough race test, then race two reservations.
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
    const [r1, r2] = await Promise.all([
      repo.tryReserveRedemption('rc-test-race', u1.id, 1),
      repo.tryReserveRedemption('rc-test-race', u2.id, 1),
    ]);
    const results = [r1, r2].sort();
    expect(results).toEqual(['exhausted', 'ok']);
  });

  it('grantRewards upserts additively', async () => {
    await seedPill('test-redeem-p');
    const u = await seedUser('rc-user-d');
    await repo.grantRewards(u.id, [{ pillId: 'test-redeem-p', quantity: 3 }]);
    await repo.grantRewards(u.id, [{ pillId: 'test-redeem-p', quantity: 2 }]);
    const item = await prisma.inventoryItem.findFirst({ where: { userId: u.id, pillId: 'test-redeem-p' } });
    expect(item?.quantity).toBe(5);
  });
});
