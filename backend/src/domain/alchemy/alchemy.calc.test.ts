import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  reserveRecipeInput,
  settleAlchemyQueue,
  validateRecipe,
} from './alchemy.calc';
import { AlchemyJobRecord, AlchemyRecipeRecord } from './alchemy';

const defaultProfile = { id: 'p', userId: 'user-1', characterId: 'character-1', rank: 1, danKhi: 0, furnaceLevel: 1 };

const recipe: AlchemyRecipeRecord = {
  id: 'recipe-hoi-khi-dan',
  pillId: 'hoi-khi-dan',
  durationSec: 1_800,
  linhThachCost: 10,
  active: true,
  tier: 2,
  minAlchemyRank: 4,
  baseSuccessPct: 60,
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
    successCount: 0,
    failCount: 0,
    critCount: 0,
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

  it('validateRecipe chặn tier/minRank/baseSuccessPct lệch rule', () => {
    expect(() => validateRecipe({ ...recipe, tier: 0 })).toThrow(DomainError);
    expect(() => validateRecipe({ ...recipe, tier: 4 })).toThrow(DomainError);
    expect(() => validateRecipe({ ...recipe, minAlchemyRank: 1 })).toThrow(DomainError); // tier 2 phải là 4
    expect(() => validateRecipe({ ...recipe, baseSuccessPct: 4 })).toThrow(DomainError);
    expect(() => validateRecipe({ ...recipe, baseSuccessPct: 101 })).toThrow(DomainError);
    expect(() => validateRecipe({ ...recipe, tier: 1, minAlchemyRank: 1, baseSuccessPct: 100 })).not.toThrow();
  });

  it('validateRecipe giữ chặn nguyên liệu trùng', () => {
    expect(() => validateRecipe({
      ...recipe,
      ingredients: [
        { materialId: 'xich-viem-tinh', quantity: 3 },
        { materialId: 'xich-viem-tinh', quantity: 2 },
      ],
    })).toThrow(DomainError);
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
      random: { next: () => 0.5 },
      profile: defaultProfile,
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
      random: { next: () => 0.5 },
      profile: defaultProfile,
    });

    expect(settled.completedJobIds).toEqual(['job-2']);
    expect(settled.outputGrants).toEqual([{ pillId: 'hoi-khi-dan', quantity: 2 }]);
  });

  it('queue rỗng trả settlement rỗng', () => {
    const settled = settleAlchemyQueue({
      now: new Date(),
      jobs: [],
      recipes: new Map(),
      random: { next: () => 0.5 },
      profile: defaultProfile,
    });
    expect(settled.completedJobIds).toEqual([]);
    expect(settled.nextRunning).toBeNull();
    expect(settled.outputGrants).toEqual([]);
  });

  it('computeSuccessPct clamp 5..95 và computeDurationSec giảm theo rank/lò', async () => {
    // Dynamic import để RED phase chỉ fail ca này (export chưa tồn tại), không vỡ cả file.
    const { computeSuccessPct, computeDurationSec } = await import('./alchemy.calc');
    // base 60 + rank 1 (+0) + lò 1 (+0) = 60 — khớp roll 0.5*100=50 < 60 trong các ca settle.
    expect(computeSuccessPct({ baseSuccessPct: 60, rank: 1, furnaceLevel: 1 })).toBe(60);
    // 90 + 15 (rank 6) + 16 (lò 5) = 121 → clamp 95.
    expect(computeSuccessPct({ baseSuccessPct: 90, rank: 6, furnaceLevel: 5 })).toBe(95);
    // 5 + 0 + 0 - 10 (Đan Đạo âm) = -5 → clamp 5.
    expect(computeSuccessPct({ baseSuccessPct: 5, rank: 1, furnaceLevel: 1, danDaoPct: -10 })).toBe(5);
    // 90 + 0 + 0 + 10 (Đan Đạo dương) = 100 → clamp 95.
    expect(computeSuccessPct({ baseSuccessPct: 90, rank: 1, furnaceLevel: 1, danDaoPct: 10 })).toBe(95);
    // speed: rank 6 (+10%) + lò 5 (+16%) = 26% → 1800 * 0.74 = 1332.
    expect(computeDurationSec({ durationSec: 1800, rank: 6, furnaceLevel: 5 })).toBe(1332);
    expect(computeDurationSec({ durationSec: 1800, rank: 1, furnaceLevel: 1 })).toBe(1800);
  });

  it('settle roll outcome: hỏng vẫn có Đan Khí và refund 30%, thành công crit x2', () => {
    const now = new Date('2026-07-27T02:00:00Z');
    const settled = settleAlchemyQueue({
      now,
      jobs: [job({ id: 'job-fail' })],
      recipes: new Map([[recipe.id, recipe]]),
      profile: defaultProfile,
      random: { next: () => 0.9 }, // 90 >= 60 → fail
    });
    expect(settled.outputGrants).toEqual([]);
    const failed = settled.jobs.find((item) => item.id === 'job-fail');
    expect(failed).toMatchObject({ status: 'completed', successCount: 0, failCount: 2, critCount: 0 });
    expect(settled.danKhiGain).toBe(4); // tier 2 fail = 2 Đan Khí/đơn vị × 2 đơn vị
    expect(settled.linhThachRefund).toBe(Math.floor(recipe.linhThachCost * 0.3) * 2);
  });

  it('settle output idempotent: job đã grant không roll lại', () => {
    const now = new Date('2026-07-27T02:00:00Z');
    const settled = settleAlchemyQueue({
      now,
      jobs: [job({ id: 'job-granted', status: 'completed', completedAt: now, outputGrantedAt: now, successCount: 2 })],
      recipes: new Map([[recipe.id, recipe]]),
      profile: defaultProfile,
      random: { next: () => 0.9 },
    });
    expect(settled.outputGrants).toEqual([]);
    expect(settled.danKhiGain).toBe(0);
    expect(settled.linhThachRefund).toBe(0);
  });
});
