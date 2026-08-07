import { DomainError } from '../errors';
import { RandomSource } from '../ports/RandomSource';
import { AlchemyJobRecord, AlchemyRecipeRecord, AlchemySettlement } from './alchemy';
import {
  AlchemyProfileRecord,
  danKhiForJob,
  failRefundPerUnit,
  furnaceSpeedPct,
  furnaceSuccessPct,
  rankSpeedPct,
  rankSuccessPct,
  rollJobOutcome,
} from './alchemy.profile';

export function validateRecipe(recipe: AlchemyRecipeRecord): void {
  if (!recipe.id || !recipe.pillId || !recipe.active || !Number.isInteger(recipe.durationSec) || recipe.durationSec <= 0 ||
      !Number.isInteger(recipe.linhThachCost) || recipe.linhThachCost < 0 || recipe.ingredients.length === 0) {
    throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid alchemy recipe: ${recipe.id}`);
  }

  const materialIds = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.materialId || materialIds.has(ingredient.materialId) || !Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) {
      throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid ingredient in recipe: ${recipe.id}`);
    }
    materialIds.add(ingredient.materialId);
  }

  const minRankByTier: Record<number, number> = { 1: 1, 2: 4, 3: 7 };
  if (!Number.isInteger(recipe.tier) || recipe.tier < 1 || recipe.tier > 3 ||
      recipe.minAlchemyRank !== minRankByTier[recipe.tier] ||
      !Number.isInteger(recipe.baseSuccessPct) || recipe.baseSuccessPct < 5 || recipe.baseSuccessPct > 100) {
    throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid tier/success config in recipe: ${recipe.id}`);
  }
}

export function reserveRecipeInput(recipe: AlchemyRecipeRecord, quantity: number) {
  validateRecipe(recipe);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('ALCHEMY_QUEUE_INVALID', 'alchemy quantity must be a positive integer');
  }
  return recipe.ingredients.map((ingredient) => ({
    materialId: ingredient.materialId,
    quantity: ingredient.quantity * quantity,
  }));
}

// Tỉ lệ thành công hiển thị/dùng khi roll: base + cấp Đan Sư + cấp lò + buff Đan Đạo, clamp 5..95.
export function computeSuccessPct(input: {
  baseSuccessPct: number; rank: number; furnaceLevel: number; danDaoPct?: number;
}): number {
  const raw = input.baseSuccessPct + rankSuccessPct(input.rank) + furnaceSuccessPct(input.furnaceLevel) + (input.danDaoPct ?? 0);
  return Math.min(95, Math.max(5, raw));
}

// Thời gian luyện giảm theo tốc độ rank + lò, không dưới 50% gốc.
export function computeDurationSec(input: { durationSec: number; rank: number; furnaceLevel: number }): number {
  const factor = Math.max(0.5, 1 - (rankSpeedPct(input.rank) + furnaceSpeedPct(input.furnaceLevel)) / 100);
  return Math.round(input.durationSec * factor);
}

export function settleAlchemyQueue(input: {
  now: Date;
  jobs: readonly AlchemyJobRecord[];
  recipes: ReadonlyMap<string, AlchemyRecipeRecord>;
  profile: AlchemyProfileRecord;
  random: RandomSource;
  danDaoPct?: number;
}): AlchemySettlement {
  const jobs = [...input.jobs]
    .map((job) => ({ ...job }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.queuedAt.getTime() - b.queuedAt.getTime() || a.id.localeCompare(b.id));
  const completedJobIds: string[] = [];
  const outputGrants = [] as AlchemySettlement['outputGrants'];
  let danKhiGain = 0;
  let linhThachRefund = 0;

  for (const job of jobs) {
    const recipe = input.recipes.get(job.recipeId);
    if (!recipe) {
      throw new DomainError('ALCHEMY_RECIPE_NOT_FOUND', `recipe not found: ${job.recipeId}`);
    }
    if (!Number.isInteger(job.quantity) || job.quantity <= 0) {
      throw new DomainError('ALCHEMY_QUEUE_INVALID', `invalid quantity in job: ${job.id}`);
    }

    if ((job.status === 'queued' || job.status === 'running') && job.completesAt.getTime() <= input.now.getTime()) {
      job.status = 'completed';
      job.completedAt ??= input.now;
      completedJobIds.push(job.id);
    }

    if (job.status === 'completed' && job.outputGrantedAt === null) {
      // Roll outcome đúng một lần khi job hoàn tất: success/fail/crit từng đơn vị,
      // Đan Khí cộng cả đơn vị hỏng, refund 30% phí Linh Thạch cho đơn vị hỏng.
      // outputGrantedAt gắn cờ đã roll (kể cả khi toàn hỏng) để settle sau không roll lại.
      const successPct = computeSuccessPct({
        baseSuccessPct: recipe.baseSuccessPct,
        rank: input.profile.rank,
        furnaceLevel: input.profile.furnaceLevel,
        danDaoPct: input.danDaoPct,
      });
      const outcome = rollJobOutcome({ quantity: job.quantity, successPct, random: input.random });
      job.successCount = outcome.successCount;
      job.failCount = outcome.failCount;
      job.critCount = outcome.critCount;
      if (outcome.grantQuantity > 0) {
        outputGrants.push({ pillId: recipe.pillId, quantity: outcome.grantQuantity });
      }
      danKhiGain += danKhiForJob({ tier: recipe.tier, successCount: outcome.successCount, failCount: outcome.failCount });
      linhThachRefund += failRefundPerUnit(recipe.linhThachCost) * outcome.failCount;
      job.outputGrantedAt = input.now;
    }
  }

  let nextRunning = jobs.find((job) => job.status === 'running') ?? null;
  if (!nextRunning) {
    nextRunning = jobs.find((job) => job.status === 'queued' && job.startsAt.getTime() <= input.now.getTime()) ?? null;
    if (nextRunning) nextRunning.status = 'running';
  }

  return {
    jobs,
    completedJobIds,
    nextRunning,
    outputGrants,
    danKhiGain,
    linhThachRefund,
    profile: { ...input.profile, danKhi: input.profile.danKhi + danKhiGain },
  };
}
