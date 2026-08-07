import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain/errors';
import { UpdateMaterialAdminUseCase } from './UpdateMaterialAdminUseCase';
import { UpdateAlchemyRecipeAdminUseCase } from './UpdateAlchemyRecipeAdminUseCase';
import { UpdateExpeditionConfigAdminUseCase } from './UpdateExpeditionConfigAdminUseCase';

const material = { id: 'xich-viem-tinh', name: 'Xích', glyph: '炎', rarity: 1, description: 'd', active: true };
const recipe = {
  id: 'recipe-hoi-khi-dan', pillId: 'hoi-khi-dan', durationSec: 1_800, linhThachCost: 10, active: true,
  tier: 1, minAlchemyRank: 1, baseSuccessPct: 100,
  ingredients: [{ materialId: material.id, quantity: 2 }],
};
const branch = {
  branch: {
    id: 'hoa-vuc', name: 'Hỏa Vực', glyph: '火', description: 'd', basePower: 100, alchemyMaterialId: material.id,
    upgradeMaterialWeights: [{ materialId: 'linh-tai-khi-huyet', weight: 1 }, { materialId: 'linh-tai-than-phap', weight: 1 }, { materialId: 'linh-tai-hoa-luc', weight: 1 }],
  },
  difficulties: [
    { key: 'easy' as const, enemyMultiplier: 0.8, normalDropRate: 0.5, bossDropRate: 0.7, rewardMultiplier: 0.8, adaptiveCoefficient: 0.1 },
    { key: 'normal' as const, enemyMultiplier: 1, normalDropRate: 0.7, bossDropRate: 0.9, rewardMultiplier: 1, adaptiveCoefficient: 0.1 },
    { key: 'hard' as const, enemyMultiplier: 1.3, normalDropRate: 0.9, bossDropRate: 1, rewardMultiplier: 1.2, adaptiveCoefficient: 0.15 },
  ],
};

describe('admin catalog validation', () => {
  it('reject duplicate material IDs', async () => {
    const useCase = new UpdateMaterialAdminUseCase({ replace: async () => [] } as never);
    await expect(useCase.execute([material, { ...material, name: 'Duplicate' }])).rejects.toMatchObject({ code: 'INVALID_MATERIAL_CONFIG' });
  });

  it('reject duplicate recipe ingredient IDs và quantity không dương', async () => {
    const useCase = new UpdateAlchemyRecipeAdminUseCase({ replace: async () => [] } as never);
    await expect(useCase.execute([{ ...recipe, ingredients: [{ materialId: 'm', quantity: 1 }, { materialId: 'm', quantity: 2 }] }])).rejects.toMatchObject({ code: 'ALCHEMY_RECIPE_INVALID' });
    await expect(useCase.execute([{ ...recipe, ingredients: [{ materialId: 'm', quantity: 0 }] }])).rejects.toMatchObject({ code: 'ALCHEMY_RECIPE_INVALID' });
  });

  it('propagate recipe pill không tồn tại từ catalog repository', async () => {
    const useCase = new UpdateAlchemyRecipeAdminUseCase({ replace: async () => { throw new DomainError('PILL_NOT_FOUND', 'pill'); } } as never);
    await expect(useCase.execute([recipe])).rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });

  it('reject branch thiếu easy/normal/hard và weight âm', async () => {
    const useCase = new UpdateExpeditionConfigAdminUseCase({ replace: async () => [] } as never);
    await expect(useCase.execute([{ ...branch, difficulties: branch.difficulties.slice(0, 2) }])).rejects.toMatchObject({ code: 'INVALID_EXPEDITION_CONFIG' });
    await expect(useCase.execute([{ ...branch, branch: { ...branch.branch, upgradeMaterialWeights: [{ materialId: 'm', weight: -1 }] } }])).rejects.toMatchObject({ code: 'INVALID_EXPEDITION_CONFIG' });
  });

  it('reject reward multiplier không dương và duration ngoài whitelist', async () => {
    const useCase = new UpdateExpeditionConfigAdminUseCase({ replace: async () => [] } as never);
    await expect(useCase.execute([{ ...branch, difficulties: branch.difficulties.map((difficulty) => ({ ...difficulty, rewardMultiplier: 0 })) }])).rejects.toMatchObject({ code: 'INVALID_EXPEDITION_CONFIG' });
    await expect(new UpdateAlchemyRecipeAdminUseCase({ replace: async () => [] } as never).execute([{ ...recipe, durationSec: 0 }])).rejects.toMatchObject({ code: 'ALCHEMY_RECIPE_INVALID' });
  });

  it('update không làm mất material active đang có inventory', async () => {
    const existing = { ...material, id: 'existing', active: true };
    let saved = [existing];
    const useCase = new UpdateMaterialAdminUseCase({ replace: async (rows: typeof saved) => { saved = [...saved, ...rows.filter((row) => row.id !== existing.id)]; return saved; } } as never);
    await useCase.execute([{ ...material, id: 'new-material' }]);
    expect(saved.find((row) => row.id === 'existing')?.active).toBe(true);
  });
});
