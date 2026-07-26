import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  reserveRecipeInput,
  settleAlchemyQueue,
  validateRecipe,
} from './alchemy.calc';
import { AlchemyJobRecord, AlchemyRecipeRecord } from './alchemy';

const recipe: AlchemyRecipeRecord = {
  id: 'recipe-hoi-khi-dan',
  pillId: 'hoi-khi-dan',
  durationSec: 1_800,
  linhThachCost: 10,
  active: true,
  ingredients: [
    { materialId: 'xich-viem-tinh', quantity: 3 },
    { materialId: 'han-bang-ngoc', quantity: 2 },
  ],
};

function job(overrides: Partial<AlchemyJobRecord>): AlchemyJobRecord {
  return {
    id: 'job-1',
    userId: 'user-1',
    characterId: 'character-1',
    recipeId: recipe.id,
    quantity: 2,
    queuedAt: new Date('2026-07-27T00:00:00Z'),
    startsAt: new Date('2026-07-27T00:00:00Z'),
    completesAt: new Date('2026-07-27T01:00:00Z'),
    completedAt: null,
    outputGrantedAt: null,
    status: 'running',
    ...overrides,
  };
}

describe('alchemy domain', () => {
  it('reserve input nhân theo quantity', () => {
    expect(reserveRecipeInput(recipe, 3)).toEqual([
      { materialId: 'xich-viem-tinh', quantity: 9 },
      { materialId: 'han-bang-ngoc', quantity: 6 },
    ]);
  });

  it('từ chối recipe inactive và quantity không hợp lệ', () => {
    expect(() => validateRecipe({ ...recipe, active: false })).toThrow(DomainError);
    expect(() => reserveRecipeInput(recipe, 0)).toThrow(DomainError);
    expect(() => reserveRecipeInput(recipe, -1)).toThrow(DomainError);
  });

  it('settle job hoàn tất, cấp output đúng một lần và bật job kế tiếp', () => {
    const now = new Date('2026-07-27T02:00:00Z');
    const settled = settleAlchemyQueue({
      now,
      jobs: [
        job({ id: 'job-1' }),
        job({
          id: 'job-2',
          status: 'queued',
          queuedAt: new Date('2026-07-27T00:01:00Z'),
          startsAt: new Date('2026-07-27T01:00:00Z'),
          completesAt: new Date('2026-07-27T03:00:00Z'),
        }),
        job({
          id: 'job-3',
          status: 'queued',
          queuedAt: new Date('2026-07-27T00:02:00Z'),
          startsAt: new Date('2026-07-27T03:00:00Z'),
          completesAt: new Date('2026-07-27T05:00:00Z'),
        }),
      ],
      recipes: new Map([[recipe.id, recipe]]),
    });

    expect(settled.completedJobIds).toEqual(['job-1']);
    expect(settled.nextRunning?.id).toBe('job-2');
    expect(settled.outputGrants).toEqual([{ pillId: 'hoi-khi-dan', quantity: 2 }]);
    expect(settled.jobs.find((item) => item.id === 'job-1')?.outputGrantedAt).toEqual(now);
    expect(settled.jobs.find((item) => item.id === 'job-2')?.status).toBe('running');
  });

  it('settle tất cả job đã hết hạn sau khi offline và không cấp lại output đã grant', () => {
    const now = new Date('2026-07-27T06:00:00Z');
    const settled = settleAlchemyQueue({
      now,
      jobs: [
        job({ id: 'job-1', completedAt: new Date('2026-07-27T01:00:00Z'), outputGrantedAt: new Date('2026-07-27T01:00:01Z'), status: 'completed' }),
        job({ id: 'job-2', status: 'queued', startsAt: new Date('2026-07-27T01:00:00Z'), completesAt: new Date('2026-07-27T03:00:00Z') }),
      ],
      recipes: new Map([[recipe.id, recipe]]),
    });

    expect(settled.completedJobIds).toEqual(['job-2']);
    expect(settled.outputGrants).toEqual([{ pillId: 'hoi-khi-dan', quantity: 2 }]);
  });

  it('queue rỗng trả settlement rỗng', () => {
    const settled = settleAlchemyQueue({ now: new Date(), jobs: [], recipes: new Map() });
    expect(settled.completedJobIds).toEqual([]);
    expect(settled.nextRunning).toBeNull();
    expect(settled.outputGrants).toEqual([]);
  });
});
