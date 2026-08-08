import { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { computeDurationSec, settleAlchemyQueue, reserveRecipeInput } from '../../domain/alchemy/alchemy.calc';
import { AlchemyJobRecord, AlchemyQueueOutput, AlchemyRecipeRecord } from '../../domain/alchemy/alchemy';
import { AlchemyProfileRecord } from '../../domain/alchemy/alchemy.profile';
import { AlchemyRepository } from '../../domain/ports/AlchemyRepository';
import { RandomSource } from '../../domain/ports/RandomSource';
import { MathRandomSource } from '../random/MathRandomSource';
import { sumSystemBuffs, PassiveEffect } from '../../domain/attributes/attributes.calc';

type RecipeRow = {
  id: string;
  pillId: string;
  durationSec: number;
  linhThachCost: number;
  tier: number;
  minAlchemyRank: number;
  baseSuccessPct: number;
  active: boolean;
  ingredients: { materialId: string; quantity: number }[];
};

type JobRow = {
  id: string;
  userId: string;
  characterId: string;
  recipeId: string;
  quantity: number;
  queuedAt: Date;
  startsAt: Date;
  completesAt: Date;
  completedAt: Date | null;
  outputGrantedAt: Date | null;
  status: string;
  successCount: number;
  failCount: number;
  critCount: number;
};

function toRecipe(row: RecipeRow): AlchemyRecipeRecord {
  return {
    id: row.id,
    pillId: row.pillId,
    durationSec: row.durationSec,
    linhThachCost: row.linhThachCost,
    tier: row.tier,
    minAlchemyRank: row.minAlchemyRank,
    baseSuccessPct: row.baseSuccessPct,
    active: row.active,
    ingredients: row.ingredients.map((ingredient) => ({ materialId: ingredient.materialId, quantity: ingredient.quantity })),
  };
}

function toJob(row: JobRow): AlchemyJobRecord {
  return {
    id: row.id,
    userId: row.userId,
    characterId: row.characterId,
    recipeId: row.recipeId,
    quantity: row.quantity,
    queuedAt: row.queuedAt,
    startsAt: row.startsAt,
    completesAt: row.completesAt,
    completedAt: row.completedAt,
    outputGrantedAt: row.outputGrantedAt,
    status: row.status as AlchemyJobRecord['status'],
    successCount: row.successCount,
    failCount: row.failCount,
    critCount: row.critCount,
  };
}

function addPillOutput(tx: Prisma.TransactionClient, userId: string, pillId: string, quantity: number) {
  return tx.inventoryItem.upsert({
    where: { userId_pillId: { userId, pillId } },
    create: { userId, pillId, quantity },
    update: { quantity: { increment: quantity } },
  });
}

export class PrismaAlchemyRepository implements AlchemyRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly random: RandomSource = new MathRandomSource(),
  ) {}

  // P2034 = serialization failure của Serializable tx: map 409 (CONCURRENT_MODIFICATION)
  // để client retry, thay vì rơi thành 500 — cùng pattern PrismaExpeditionRepository.
  private async runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new DomainError('CONCURRENT_MODIFICATION', 'dữ liệu luyện đan vừa được thay đổi bởi request khác');
      }
      throw error;
    }
  }

  async listRecipes(): Promise<AlchemyRecipeRecord[]> {
    const rows = await this.client.alchemyRecipe.findMany({ include: { ingredients: true }, orderBy: { id: 'asc' } });
    return rows.map(toRecipe);
  }

  async listQueue(userId: string): Promise<AlchemyJobRecord[]> {
    const rows = await this.client.alchemyJob.findMany({ where: { userId }, orderBy: [{ startsAt: 'asc' }, { queuedAt: 'asc' }] });
    return rows.map(toJob);
  }

  async getProfile(userId: string): Promise<AlchemyProfileRecord> {
    const profile = await this.client.alchemyProfile.upsert({
      where: { userId },
      create: { userId, characterId: await this.characterIdFor(userId) },
      update: {},
    });
    return profile;
  }

  private async characterIdFor(userId: string): Promise<string> {
    const character = await this.client.character.findUnique({ where: { userId }, select: { id: true } });
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    return character.id;
  }

  async rankUp(userId: string, targetRank: number, danKhiCost: number, danHoaTuyCost = 0): Promise<AlchemyProfileRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const updated = await tx.alchemyProfile.updateMany({
          where: { userId, rank: targetRank - 1, danKhi: { gte: danKhiCost } },
          data: { rank: targetRank, danKhi: { decrement: danKhiCost } },
        });
        if (updated.count !== 1) throw new DomainError('INSUFFICIENT_DAN_KHI', 'không đủ Đan Khí hoặc sai cấp hiện tại');
        if (danHoaTuyCost > 0) {
          const tuy = await tx.materialInventory.updateMany({
            where: { userId, materialId: 'dan-hoa-tuy', quantity: { gte: danHoaTuyCost } },
            data: { quantity: { decrement: danHoaTuyCost } },
          });
          if (tuy.count !== 1) throw new DomainError('ALCHEMY_MISSING_DAN_HOA_TUY', 'không đủ Đan Hỏa Tủy');
        }
        const profile = await tx.alchemyProfile.findUniqueOrThrow({ where: { userId } });
        return {
          id: profile.id, userId: profile.userId, characterId: profile.characterId,
          rank: profile.rank, danKhi: profile.danKhi, furnaceLevel: profile.furnaceLevel,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new DomainError('CONCURRENT_MODIFICATION', 'Hồ sơ Đan Sư vừa được thay đổi bởi request khác');
      }
      throw error;
    }
  }

  async upgradeFurnace(input: {
    userId: string; characterId: string; targetLevel: number; danKhiCost: number; linhThachCost: number;
  }): Promise<AlchemyProfileRecord> {
    return this.runSerializable(async (tx) => {
      const profile = await tx.alchemyProfile.updateMany({
        where: { userId: input.userId, furnaceLevel: input.targetLevel - 1, danKhi: { gte: input.danKhiCost } },
        data: { furnaceLevel: input.targetLevel, danKhi: { decrement: input.danKhiCost } },
      });
      if (profile.count !== 1) throw new DomainError('INSUFFICIENT_DAN_KHI', 'không đủ Đan Khí hoặc sai cấp lò');
      const character = await tx.character.updateMany({
        where: { id: input.characterId, userId: input.userId, linhThach: { gte: input.linhThachCost } },
        data: { linhThach: { decrement: input.linhThachCost } },
      });
      if (character.count !== 1) throw new DomainError('INSUFFICIENT_LINH_THACH', 'không đủ Linh Thạch');
      return tx.alchemyProfile.findUniqueOrThrow({ where: { userId: input.userId } });
    });
  }

  async enqueue(input: {
    userId: string;
    characterId: string;
    recipeId: string;
    quantity: number;
    now: Date;
  }): Promise<AlchemyQueueOutput> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new DomainError('ALCHEMY_QUEUE_INVALID', 'alchemy quantity must be a positive integer');
    }

    return this.runSerializable(async (tx) => {
      const settled = await this.settleInTransaction(tx, input.userId, input.now);
      const recipeRows = await tx.alchemyRecipe.findMany({ include: { ingredients: true } });
      const recipe = recipeRows.map(toRecipe).find((item) => item.id === input.recipeId);
      if (!recipe) throw new DomainError('ALCHEMY_RECIPE_NOT_FOUND', `recipe not found: ${input.recipeId}`);
      if (!recipe.active) throw new DomainError('ALCHEMY_QUEUE_INVALID', `recipe is inactive: ${input.recipeId}`);

      const materialLines = reserveRecipeInput(recipe, input.quantity);
      for (const line of materialLines) {
        const result = await tx.materialInventory.updateMany({
          where: { userId: input.userId, materialId: line.materialId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity } },
        });
        if (result.count !== 1) throw new DomainError('INSUFFICIENT_MATERIALS', 'not enough alchemy materials');
      }

      const linhThachCost = recipe.linhThachCost * input.quantity;
      const character = await tx.character.updateMany({
        where: { id: input.characterId, userId: input.userId, linhThach: { gte: linhThachCost } },
        data: { linhThach: { decrement: linhThachCost } },
      });
      if (character.count !== 1) throw new DomainError('INSUFFICIENT_LINH_THACH', 'not enough Linh Thạch');

      const profile = await tx.alchemyProfile.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, characterId: input.characterId },
        update: {},
      });
      if (profile.rank < recipe.minAlchemyRank) {
        throw new DomainError('ALCHEMY_RANK_TOO_LOW', `cần Đan Sư cấp ${recipe.minAlchemyRank} cho công thức này`);
      }

      const latestCompletion = settled.jobs.reduce((latest, job) => Math.max(latest, job.completesAt.getTime()), input.now.getTime());
      const startsAt = new Date(Math.max(input.now.getTime(), latestCompletion));
      const effectiveSec = computeDurationSec({ durationSec: recipe.durationSec, rank: profile.rank, furnaceLevel: profile.furnaceLevel });
      const completesAt = new Date(startsAt.getTime() + effectiveSec * 1000);
      const created = await tx.alchemyJob.create({
        data: {
          userId: input.userId,
          characterId: input.characterId,
          recipeId: input.recipeId,
          quantity: input.quantity,
          queuedAt: input.now,
          startsAt,
          completesAt,
          status: startsAt.getTime() <= input.now.getTime() ? 'running' : 'queued',
        },
      });

      return { jobs: [...settled.jobs, toJob(created)], outputGrants: settled.outputGrants };
    });
  }

  async settleCompleted(userId: string, now: Date): Promise<AlchemyQueueOutput> {
    return this.runSerializable((tx) => this.settleInTransaction(tx, userId, now));
  }

  private async settleInTransaction(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<AlchemyQueueOutput> {
    // Đọc/ghi qua tx (không qua this.client) để nằm trong snapshot Serializable.
    const character = await tx.character.findUnique({ where: { userId }, select: { id: true } });
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    const profile = await tx.alchemyProfile.upsert({
      where: { userId },
      create: { userId, characterId: character.id },
      update: {},
    });
    const [recipeRows, jobRows, ownedRows] = await Promise.all([
      tx.alchemyRecipe.findMany({ include: { ingredients: true } }),
      tx.alchemyJob.findMany({ where: { userId }, orderBy: [{ startsAt: 'asc' }, { queuedAt: 'asc' }] }),
      // Buff Đan Đạo (Phase 2) đọc trong cùng snapshot Serializable.
      tx.ownedCongPhap.findMany({ where: { userId }, include: { congPhap: true } }),
    ]);
    const recipes = new Map(recipeRows.map((row) => {
      const recipe = toRecipe(row);
      return [recipe.id, recipe] as const;
    }));
    const danDaoPct = sumSystemBuffs(
      ownedRows
        .filter((r) => r.congPhap.category === 'passive' && r.congPhap.active && r.congPhap.effects)
        .map((r) => ({ level: r.level, effects: r.congPhap.effects as unknown as PassiveEffect[] })),
    ).danDaoSuccessPct;
    const settlement = settleAlchemyQueue({ now, jobs: jobRows.map(toJob), recipes, profile, random: this.random, danDaoPct });

    for (const job of settlement.jobs) {
      await tx.alchemyJob.update({
        where: { id: job.id },
        data: {
          status: job.status,
          completedAt: job.completedAt,
          outputGrantedAt: job.outputGrantedAt,
          successCount: job.successCount,
          failCount: job.failCount,
          critCount: job.critCount,
        },
      });
    }
    for (const grant of settlement.outputGrants) {
      await addPillOutput(tx, userId, grant.pillId, grant.quantity);
    }
    // settlement.profile là bản copy domain đã cộng sẵn Đan Khí — KHÔNG ghi lại giá trị
    // đó, chỉ increment theo delta để hai lần settle trùng nhau không cộng double.
    if (settlement.danKhiGain > 0) {
      await tx.alchemyProfile.update({ where: { userId }, data: { danKhi: { increment: settlement.danKhiGain } } });
    }
    if (settlement.linhThachRefund > 0) {
      await tx.character.update({ where: { id: profile.characterId }, data: { linhThach: { increment: settlement.linhThachRefund } } });
    }
    return { jobs: settlement.jobs, outputGrants: settlement.outputGrants };
  }
}
