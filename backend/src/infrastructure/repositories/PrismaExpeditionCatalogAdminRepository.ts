import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { ExpeditionCatalogAdminRepository } from '../../domain/ports/ExpeditionCatalogAdminRepository';
import { ExpeditionBranchBundle } from '../../domain/ports/ExpeditionConfigRepository';
import { PrismaExpeditionConfigRepository } from './PrismaExpeditionConfigRepository';

export class PrismaExpeditionCatalogAdminRepository implements ExpeditionCatalogAdminRepository {
  private readonly reader: PrismaExpeditionConfigRepository;

  constructor(private readonly client: PrismaClient) {
    this.reader = new PrismaExpeditionConfigRepository(client);
  }

  async list(): Promise<ExpeditionBranchBundle[]> {
    return this.reader.listBranches();
  }

  async replace(rows: readonly ExpeditionBranchBundle[]): Promise<ExpeditionBranchBundle[]> {
    await this.client.$transaction(async (tx) => {
      for (const row of rows) {
        if (!await tx.material.findUnique({ where: { id: row.branch.alchemyMaterialId }, select: { id: true } })) {
          throw new DomainError('MATERIAL_NOT_FOUND', `branch material not found: ${row.branch.alchemyMaterialId}`);
        }
        for (const weight of row.branch.upgradeMaterialWeights) {
          if (!await tx.material.findUnique({ where: { id: weight.materialId }, select: { id: true } })) {
            throw new DomainError('MATERIAL_NOT_FOUND', `upgrade material not found: ${weight.materialId}`);
          }
        }
        await tx.expeditionBranch.upsert({
          where: { id: row.branch.id },
          create: { id: row.branch.id, name: row.branch.name, glyph: row.branch.glyph, description: row.branch.description, basePower: row.branch.basePower, alchemyMaterialId: row.branch.alchemyMaterialId },
          update: { name: row.branch.name, glyph: row.branch.glyph, description: row.branch.description, basePower: row.branch.basePower, alchemyMaterialId: row.branch.alchemyMaterialId },
        });
        for (const difficulty of row.difficulties) {
          await tx.expeditionDifficulty.upsert({
            where: { branchId_key: { branchId: row.branch.id, key: difficulty.key } },
            create: { branchId: row.branch.id, key: difficulty.key, enemyMultiplier: difficulty.enemyMultiplier, normalDropRate: difficulty.normalDropRate, bossDropRate: difficulty.bossDropRate, rewardMultiplier: difficulty.rewardMultiplier, adaptiveCoefficient: difficulty.adaptiveCoefficient },
            update: { enemyMultiplier: difficulty.enemyMultiplier, normalDropRate: difficulty.normalDropRate, bossDropRate: difficulty.bossDropRate, rewardMultiplier: difficulty.rewardMultiplier, adaptiveCoefficient: difficulty.adaptiveCoefficient },
          });
        }
        await tx.expeditionUpgradeMaterialWeight.deleteMany({ where: { branchId: row.branch.id } });
        await tx.expeditionUpgradeMaterialWeight.createMany({ data: row.branch.upgradeMaterialWeights.map((weight) => ({ branchId: row.branch.id, materialId: weight.materialId, weight: weight.weight })) });
      }
    });
    return this.list();
  }
}
