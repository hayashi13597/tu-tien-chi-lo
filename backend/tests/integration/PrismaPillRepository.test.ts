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
  afterAll(async () => { await prisma.$disconnect(); });

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
});
