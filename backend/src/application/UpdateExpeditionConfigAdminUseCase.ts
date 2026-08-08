import { DomainError } from '../domain/errors';
import { ExpeditionCatalogAdminRepository } from '../domain/ports/ExpeditionCatalogAdminRepository';
import { ExpeditionBranchBundle } from '../domain/ports/ExpeditionConfigRepository';

export class UpdateExpeditionConfigAdminUseCase {
  constructor(private readonly repo: ExpeditionCatalogAdminRepository) {}

  async execute(rows: readonly ExpeditionBranchBundle[]): Promise<ExpeditionBranchBundle[]> {
    const branchIds = new Set<string>();
    for (const row of rows) {
      if (!row.branch.id || branchIds.has(row.branch.id) || !row.branch.alchemyMaterialId || row.branch.basePower <= 0) {
        throw new DomainError('INVALID_EXPEDITION_CONFIG', `invalid branch: ${row.branch.id}`);
      }
      branchIds.add(row.branch.id);
      const difficultyKeys = new Set(row.difficulties.map((difficulty) => difficulty.key));
      if (difficultyKeys.size !== 3 || !(['easy', 'normal', 'hard'] as const).every((key) => difficultyKeys.has(key))) {
        throw new DomainError('INVALID_EXPEDITION_CONFIG', `branch ${row.branch.id} must have easy, normal and hard`);
      }
      for (const difficulty of row.difficulties) {
        if (difficulty.enemyMultiplier <= 0 || difficulty.normalDropRate < 0 || difficulty.normalDropRate > 1 || difficulty.bossDropRate < 0 || difficulty.bossDropRate > 1 || difficulty.rewardMultiplier <= 0 || difficulty.adaptiveCoefficient < 0) {
          throw new DomainError('INVALID_EXPEDITION_CONFIG', `invalid difficulty: ${difficulty.key}`);
        }
      }
      // Phase 3 — tầng/gate/chiến lực + bảng boss drop.
      if (!Number.isInteger(row.branch.tier) || row.branch.tier < 1 || row.branch.tier > 3) {
        throw new DomainError('INVALID_EXPEDITION_CONFIG', `branch ${row.branch.id}: tier must be 1..3`);
      }
      if (!Number.isInteger(row.branch.minRealmMajor) || row.branch.minRealmMajor < 0 || row.branch.minRealmMajor > 10) {
        throw new DomainError('INVALID_EXPEDITION_CONFIG', `branch ${row.branch.id}: minRealmMajor must be 0..10`);
      }
      if (!(row.branch.recommendedPower >= 0)) {
        throw new DomainError('INVALID_EXPEDITION_CONFIG', `branch ${row.branch.id}: recommendedPower must be >= 0`);
      }
      for (const weight of row.branch.bossDropWeights) {
        if (!weight.materialId || weight.weight < 0) throw new DomainError('INVALID_EXPEDITION_CONFIG', `invalid boss drop weight: ${weight.materialId}`);
      }
      for (const weight of row.branch.upgradeMaterialWeights) {
        if (!weight.materialId || weight.weight < 0) throw new DomainError('INVALID_EXPEDITION_CONFIG', `invalid upgrade weight: ${weight.materialId}`);
      }
    }
    return this.repo.replace(rows);
  }
}
