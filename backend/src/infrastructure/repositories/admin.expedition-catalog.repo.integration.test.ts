import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaMaterialCatalogAdminRepository } from './PrismaMaterialCatalogAdminRepository';
import { PrismaAlchemyCatalogAdminRepository } from './PrismaAlchemyCatalogAdminRepository';
import { PrismaExpeditionCatalogAdminRepository } from './PrismaExpeditionCatalogAdminRepository';

const prisma = new PrismaClient();
const materials = new PrismaMaterialCatalogAdminRepository(prisma);
const recipes = new PrismaAlchemyCatalogAdminRepository(prisma);
const expeditions = new PrismaExpeditionCatalogAdminRepository(prisma);

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

describe('admin catalog Prisma repositories', () => {
  it('replace material live và giữ catalog rows ngoài payload', async () => {
    const before = await materials.list();
    const original = before.find((row) => row.id === 'xich-viem-tinh')!;
    const saved = await materials.replace([{ ...original, description: 'admin test update' }]);
    expect(saved).toHaveLength(before.length);
    expect(saved.find((row) => row.id === original.id)?.description).toBe('admin test update');
    await materials.replace([original]);
  });

  it('replace recipe và expedition branch theo transaction', async () => {
    const recipeBefore = (await recipes.list()).find((row) => row.id === 'recipe-hoi-khi-dan')!;
    const recipeAfter = await recipes.replace([{ ...recipeBefore, linhThachCost: recipeBefore.linhThachCost + 1 }]);
    expect(recipeAfter.find((row) => row.id === recipeBefore.id)?.linhThachCost).toBe(recipeBefore.linhThachCost + 1);
    await recipes.replace([recipeBefore]);

    const branchBefore = (await expeditions.list()).find((row) => row.branch.id === 'hoa-vuc')!;
    const branchAfter = await expeditions.replace([{ ...branchBefore, branch: { ...branchBefore.branch, basePower: branchBefore.branch.basePower + 1 } }]);
    expect(branchAfter.find((row) => row.branch.id === branchBefore.branch.id)?.branch.basePower).toBe(branchBefore.branch.basePower + 1);
    await expeditions.replace([branchBefore]);
  });

  it('round-trip tier/gate/recommendedPower/bossDropWeights (Phase 3)', async () => {
    await prisma.material.upsert({
      where: { id: 'dan-hoa-tuy' },
      create: { id: 'dan-hoa-tuy', name: 'Đan Hỏa Tủy', glyph: '髓', rarity: 5, tier: 3, description: 'test' },
      update: {},
    });
    const before = (await expeditions.list()).find((row) => row.branch.id === 'hoa-vuc')!;
    const modified: typeof before = {
      ...before,
      branch: {
        ...before.branch,
        tier: 2,
        minRealmMajor: 3,
        recommendedPower: 600,
        bossDropWeights: [{ materialId: 'dan-hoa-tuy', weight: 0.3 }],
      },
    };
    const saved = await expeditions.replace([modified]);
    const row = saved.find((r) => r.branch.id === 'hoa-vuc')!.branch;
    expect(row.tier).toBe(2);
    expect(row.minRealmMajor).toBe(3);
    expect(row.recommendedPower).toBe(600);
    expect(row.bossDropWeights).toEqual([{ materialId: 'dan-hoa-tuy', weight: 0.3 }]);
    await expeditions.replace([before]);
  });
});
