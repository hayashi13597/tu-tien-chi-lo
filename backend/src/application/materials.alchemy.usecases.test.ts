import { describe, expect, it } from 'vitest';
import { GetMaterialInventoryUseCase } from './GetMaterialInventoryUseCase';
import { GetAlchemyQueueUseCase } from './GetAlchemyQueueUseCase';
import { QueueAlchemyUseCase } from './QueueAlchemyUseCase';
import { AlchemyJobRecord, AlchemyQueueOutput, AlchemyRecipeRecord } from '../domain/alchemy/alchemy';
import { MaterialInventoryRecord } from '../domain/materials/material';

const recipe: AlchemyRecipeRecord = {
  id: 'recipe-hoi-khi-dan',
  pillId: 'hoi-khi-dan',
  durationSec: 1_800,
  linhThachCost: 10,
  active: true,
  tier: 1,
  minAlchemyRank: 1,
  baseSuccessPct: 100,
  ingredients: [{ materialId: 'xich-viem-tinh', quantity: 3 }],
};

function job(): AlchemyJobRecord {
  return {
    id: 'job-1', userId: 'u', characterId: 'c', recipeId: recipe.id, quantity: 2,
    queuedAt: new Date('2026-07-27T00:00:00Z'), startsAt: new Date('2026-07-27T00:00:00Z'),
    completesAt: new Date('2026-07-27T01:00:00Z'), completedAt: null, outputGrantedAt: null, status: 'running',
    successCount: 0, failCount: 0, critCount: 0,
  };
}

function buildFakes(options: {
  inventory?: MaterialInventoryRecord[];
  linhThach?: number;
  recipes?: AlchemyRecipeRecord[];
  settled?: AlchemyQueueOutput;
} = {}) {
  let enqueueCalls = 0;
  const character = { id: 'c', userId: 'u', linhThach: options.linhThach ?? 100 };
  const settled = options.settled ?? { jobs: [job()], outputGrants: [] };
  const materials = {
    listInventory: async () => options.inventory ?? [{
      materialId: 'xich-viem-tinh', quantity: 5,
      material: { id: 'xich-viem-tinh', name: 'Xích Viêm Tinh', glyph: '炎', rarity: 1, tier: 1, description: 'd', active: true },
    }, {
      materialId: 'inactive', quantity: 9,
      material: { id: 'inactive', name: 'Inactive', glyph: 'x', rarity: 1, tier: 1, description: 'd', active: false },
    }],
  };
  const alchemy = {
    listRecipes: async () => options.recipes ?? [recipe],
    listQueue: async () => [job()],
    getProfile: async () => ({ id: 'p', userId: 'u', characterId: 'c', rank: 1, danKhi: 0, furnaceLevel: 1 }),
    settleCompleted: async () => settled,
    enqueue: async () => { enqueueCalls += 1; return settled; },
  };
  const characters = { findByUserId: async () => character };
  return { materials, alchemy, characters, get enqueueCalls() { return enqueueCalls; } };
}

describe('material/alchemy use cases', () => {
  it('inventory chỉ trả material active và quantity dương', async () => {
    const f = buildFakes({ inventory: [
      {
        materialId: 'active', quantity: 2,
        material: { id: 'active', name: 'Active', glyph: 'a', rarity: 1, tier: 1, description: 'd', active: true },
      },
      {
        materialId: 'inactive', quantity: 9,
        material: { id: 'inactive', name: 'Inactive', glyph: 'x', rarity: 1, tier: 1, description: 'd', active: false },
      },
      { materialId: 'empty', quantity: 0, material: { id: 'empty', name: 'Empty', glyph: 'e', rarity: 1, tier: 1, description: 'd', active: true } },
    ] });
    const result = await new GetMaterialInventoryUseCase(f.materials as never).execute('u');
    expect(result.map((item) => item.materialId)).toEqual(['active']);
  });

  it('enqueue thiếu nguyên liệu trả INSUFFICIENT_MATERIALS và không enqueue', async () => {
    const f = buildFakes({ inventory: [{ materialId: 'xich-viem-tinh', quantity: 2, material: { id: 'xich-viem-tinh', name: 'X', glyph: 'x', rarity: 1, tier: 1, description: 'd', active: true } }] });
    await expect(new QueueAlchemyUseCase(f.alchemy as never, f.materials as never, f.characters as never).execute('u', recipe.id, 1))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_MATERIALS' });
    expect(f.enqueueCalls).toBe(0);
  });

  it('enqueue thiếu Linh Thạch trả INSUFFICIENT_LINH_THACH', async () => {
    const f = buildFakes({ linhThach: 9 });
    await expect(new QueueAlchemyUseCase(f.alchemy as never, f.materials as never, f.characters as never).execute('u', recipe.id, 1))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_THACH' });
    expect(f.enqueueCalls).toBe(0);
  });

  it('quantity 0, âm và recipe inactive trả ALCHEMY_QUEUE_INVALID', async () => {
    const f = buildFakes({ recipes: [{ ...recipe, active: false }] });
    const useCase = new QueueAlchemyUseCase(f.alchemy as never, f.materials as never, f.characters as never);
    await expect(useCase.execute('u', recipe.id, 0)).rejects.toMatchObject({ code: 'ALCHEMY_QUEUE_INVALID' });
    await expect(useCase.execute('u', recipe.id, -1)).rejects.toMatchObject({ code: 'ALCHEMY_QUEUE_INVALID' });
    await expect(useCase.execute('u', recipe.id, 1)).rejects.toMatchObject({ code: 'ALCHEMY_QUEUE_INVALID' });
  });

  it('queue settle output hết hạn đúng một lần trước khi trả', async () => {
    const f = buildFakes({ settled: { jobs: [job()], outputGrants: [{ pillId: 'hoi-khi-dan', quantity: 2 }] } });
    const result = await new GetAlchemyQueueUseCase(f.alchemy as never).execute('u', new Date('2026-07-27T02:00:00Z'));
    expect(result.outputGrants).toEqual([{ pillId: 'hoi-khi-dan', quantity: 2 }]);
  });
});
