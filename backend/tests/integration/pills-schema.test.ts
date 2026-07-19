import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('pills schema + seed', () => {
  beforeAll(async () => {
    // Ensure the catalog exists even if this file runs before a manual seed.
    const { execSync } = await import('node:child_process');
    execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('seeds all 8 pills with valid rarities and effect kinds', async () => {
    const pills = await prisma.pill.findMany();
    expect(pills.length).toBeGreaterThanOrEqual(8);
    const kinds = ['linhKhi', 'cultivationBuff', 'breakthroughBoost', 'clearPunishment'];
    for (const p of pills) {
      expect(p.rarity).toBeGreaterThanOrEqual(0);
      expect(p.rarity).toBeLessThanOrEqual(4);
      expect(kinds).toContain(p.effectKind);
    }
  });

  it('exposes the new Character buff/bonus columns with defaults', async () => {
    const user = await prisma.user.create({ data: { username: `schema-${Date.now()}`, passwordHash: 'x' } });
    const c = await prisma.character.create({ data: { userId: user.id } });
    expect(c.breakthroughBonusPct).toBe(0);
    expect(c.cultivationBuffMultiplier).toBeNull();
    expect(c.cultivationBuffUntil).toBeNull();
    await prisma.character.delete({ where: { id: c.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('seeds active + starterQuantity on every pill (old STARTER_INVENTORY values)', async () => {
    const expected: Record<string, number> = {
      'hoi-khi-dan': 5, 'tu-linh-dan': 3, 'cuu-chuyen-kim-dan': 1, 'tinh-tam-dan': 2,
      'ngung-than-dan': 1, 'pha-canh-dan': 2, 'thien-cang-dan': 1, 'giai-phat-dan': 2,
    };
    for (const [id, qty] of Object.entries(expected)) {
      const p = await prisma.pill.findUnique({ where: { id } });
      expect(p?.active).toBe(true);
      expect(p?.starterQuantity).toBe(qty);
    }
  });
});
