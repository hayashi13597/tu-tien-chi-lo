import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPillRepository } from '../../src/infrastructure/repositories/PrismaPillRepository';

const prisma = new PrismaClient();
const repo = new PrismaPillRepository(prisma);

async function makeUser() {
  const user = await prisma.user.create({ data: { username: `pill-${Date.now()}-${Math.random()}`, passwordHash: 'x' } });
  return user.id;
}

describe('PrismaPillRepository', () => {
  beforeAll(async () => {
    const { execSync } = await import('node:child_process');
    execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  });
  afterAll(async () => {
    // Remove the test-only pills (and any inventory rows referencing them) so a
    // rerun doesn't collide on the unique id and the leaked active starter pill
    // doesn't perturb register-based tests in other files.
    await prisma.inventoryItem.deleteMany({ where: { pillId: { startsWith: 'test-' } } });
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
    await prisma.$disconnect();
  });

  it('seeds starter inventory and lists it', async () => {
    const userId = await makeUser();
    await repo.seedStarterInventory(userId);
    const inv = await repo.listInventory(userId);
    expect(inv.length).toBe(8);
    const hoiKhi = inv.find((e) => e.pill.id === 'hoi-khi-dan');
    expect(hoiKhi?.quantity).toBe(5);
  });

  it('decrementOne succeeds while quantity > 0 and fails at 0', async () => {
    const userId = await makeUser();
    await prisma.inventoryItem.create({ data: { userId, pillId: 'giai-phat-dan', quantity: 1 } });
    expect(await repo.decrementOne(userId, 'giai-phat-dan')).toBe(true);
    expect(await repo.decrementOne(userId, 'giai-phat-dan')).toBe(false);
  });

  it('decrementOne is atomic under a concurrent race (only quantity-many succeed)', async () => {
    const userId = await makeUser();
    await prisma.inventoryItem.create({ data: { userId, pillId: 'hoi-khi-dan', quantity: 3 } });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => repo.decrementOne(userId, 'hoi-khi-dan')),
    );
    expect(results.filter(Boolean).length).toBe(3);
    const row = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId, pillId: 'hoi-khi-dan' } } });
    expect(row?.quantity).toBe(0);
  });

  it('incrementOne gives a spent unit back (decrement compensation)', async () => {
    const userId = await makeUser();
    await prisma.inventoryItem.create({ data: { userId, pillId: 'giai-phat-dan', quantity: 1 } });
    expect(await repo.decrementOne(userId, 'giai-phat-dan')).toBe(true);
    await repo.incrementOne(userId, 'giai-phat-dan');
    const row = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId, pillId: 'giai-phat-dan' } } });
    expect(row?.quantity).toBe(1);
  });

  it('listAll returns the full catalog including inactive pills', async () => {
    await prisma.pill.create({ data: { id: 'test-inactive', name: 'T', glyph: 't', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 0 } });
    const all = await repo.listAll();
    expect(all.some((p) => p.id === 'test-inactive')).toBe(true);
    expect(all.some((p) => p.id === 'hoi-khi-dan')).toBe(true);
  });

  it('create + update round-trip', async () => {
    await repo.create({ id: 'test-crud', name: 'CRUD Đan', glyph: 'c', rarity: 1, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0 });
    const created = await repo.findById('test-crud');
    expect(created?.name).toBe('CRUD Đan');

    const ok = await repo.update({ ...created!, name: 'CRUD Đan v2', amount: 99 });
    expect(ok).toBe(true);
    const updated = await repo.findById('test-crud');
    expect(updated?.name).toBe('CRUD Đan v2');
    expect(updated?.amount).toBe(99);
  });

  it('update returns false for an unknown id', async () => {
    const ok = await repo.update({ id: 'test-ghost', name: 'G', glyph: 'g', rarity: 0, effectKind: 'linhKhi', amount: 1, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0 });
    expect(ok).toBe(false);
  });

  it('listInventory hides inactive pills but keeps their InventoryItem rows', async () => {
    const userId = await makeUser();
    await prisma.pill.create({ data: { id: 'test-hidden', name: 'H', glyph: 'h', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 0 } });
    await prisma.inventoryItem.create({ data: { userId, pillId: 'test-hidden', quantity: 4 } });

    const inv = await repo.listInventory(userId);
    expect(inv.some((e) => e.pill.id === 'test-hidden')).toBe(false);
    // The row survives — re-enabling restores the holding.
    const row = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId, pillId: 'test-hidden' } } });
    expect(row?.quantity).toBe(4);
  });

  it('seedStarterInventory grants per starterQuantity and skips inactive/zero pills', async () => {
    await prisma.pill.create({ data: { id: 'test-starter', name: 'S', glyph: 's', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: true, starterQuantity: 7 } });
    await prisma.pill.create({ data: { id: 'test-starter-off', name: 'SO', glyph: 's', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 7 } });
    const userId = await makeUser();
    await repo.seedStarterInventory(userId);

    const rows = await prisma.inventoryItem.findMany({ where: { userId } });
    const byPill = new Map(rows.map((r) => [r.pillId, r.quantity]));
    expect(byPill.get('test-starter')).toBe(7);      // custom starter granted
    expect(byPill.get('hoi-khi-dan')).toBe(5);        // seeded starters still granted
    expect(byPill.has('test-starter-off')).toBe(false); // inactive: not granted
  });
});
