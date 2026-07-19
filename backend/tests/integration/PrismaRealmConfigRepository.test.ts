import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaRealmConfigRepository } from '../../src/infrastructure/repositories/PrismaRealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

const repo = new PrismaRealmConfigRepository(prisma);

const rows: SubStageRow[] = [
  { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
  { realmMajor: 0, realmSub: 1, realmName: 'A', subStageName: 'A1', linhKhiRequired: 200, cultivationRate: 1.2, baseSuccessRate: 88, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 400 },
];

beforeEach(async () => {
  await prisma.realmStage.deleteMany();
});
afterAll(async () => {
  // Restore the seeded config so later suites see the standard 12×5 data —
  // this file's tests replace RealmStage with tiny fixtures, and suites like
  // cultivation.breakthrough assume the real balance (same convention as
  // admin.routes.test.ts).
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  await prisma.$disconnect();
});

describe('PrismaRealmConfigRepository', () => {
  it('replaceAll then loadAll round-trips ordered rows', async () => {
    await repo.replaceAll(rows);
    const loaded = await repo.loadAll();
    expect(loaded.map((r) => r.subStageName)).toEqual(['A0', 'A1']);
    expect(loaded[1].linhKhiRequired).toBe(200);
  });

  it('replaceAll fully replaces the previous config (no leftover rows)', async () => {
    await repo.replaceAll(rows);
    await repo.replaceAll([
      { realmMajor: 0, realmSub: 0, realmName: 'B', subStageName: 'B0', linhKhiRequired: 500, cultivationRate: 2, baseSuccessRate: 80, pityIncrement: 8, maxSuccessRate: 95, punishmentSeconds: 600 },
    ]);
    const loaded = await repo.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].realmName).toBe('B');
  });
});
