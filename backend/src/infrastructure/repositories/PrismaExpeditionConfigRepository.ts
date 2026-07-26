import { PrismaClient } from '@prisma/client';
import { ExpeditionConfigRepository, ExpeditionBranchBundle } from '../../domain/ports/ExpeditionConfigRepository';
import { ExpeditionBranchConfig, ExpeditionDifficultyConfig } from '../../domain/expedition/expedition';

function toBundle(row: {
  id: string; name: string; glyph: string; description: string; basePower: number; alchemyMaterialId: string;
  difficulties: { key: string; enemyMultiplier: number; normalDropRate: number; bossDropRate: number; rewardMultiplier: number; adaptiveCoefficient: number }[];
  upgradeWeights: { materialId: string; weight: number }[];
}): ExpeditionBranchBundle {
  const branch: ExpeditionBranchConfig = {
    id: row.id, name: row.name, glyph: row.glyph, description: row.description, basePower: row.basePower,
    alchemyMaterialId: row.alchemyMaterialId,
    upgradeMaterialWeights: row.upgradeWeights.map((weight) => ({ materialId: weight.materialId, weight: weight.weight })),
  };
  const difficulties: ExpeditionDifficultyConfig[] = row.difficulties.map((difficulty) => ({
    key: difficulty.key as ExpeditionDifficultyConfig['key'],
    enemyMultiplier: difficulty.enemyMultiplier,
    normalDropRate: difficulty.normalDropRate,
    bossDropRate: difficulty.bossDropRate,
    rewardMultiplier: difficulty.rewardMultiplier,
    adaptiveCoefficient: difficulty.adaptiveCoefficient,
  }));
  return { branch, difficulties };
}

export class PrismaExpeditionConfigRepository implements ExpeditionConfigRepository {
  constructor(private readonly client: PrismaClient) {}

  async listBranches(): Promise<ExpeditionBranchBundle[]> {
    const rows = await this.client.expeditionBranch.findMany({
      include: { difficulties: { orderBy: { key: 'asc' } }, upgradeWeights: { orderBy: { materialId: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    return rows.map(toBundle);
  }

  async getBranch(branchId: string): Promise<ExpeditionBranchBundle | null> {
    const row = await this.client.expeditionBranch.findUnique({
      where: { id: branchId },
      include: { difficulties: { orderBy: { key: 'asc' } }, upgradeWeights: { orderBy: { materialId: 'asc' } } },
    });
    return row ? toBundle(row) : null;
  }
}
