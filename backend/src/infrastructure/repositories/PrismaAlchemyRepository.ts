import { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { settleAlchemyQueue, reserveRecipeInput } from '../../domain/alchemy/alchemy.calc';
import { AlchemyJobRecord, AlchemyQueueOutput, AlchemyRecipeRecord } from '../../domain/alchemy/alchemy';
import { AlchemyRepository } from '../../domain/ports/AlchemyRepository';

type RecipeRow = {
  id: string;
  pillId: string;
  durationSec: number;
  linhThachCost: number;
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
};

function toRecipe(row: RecipeRow): AlchemyRecipeRecord {
  return {
    id: row.id,
    pillId: row.pillId,
    durationSec: row.durationSec,
    linhThachCost: row.linhThachCost,
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
  constructor(private readonly client: PrismaClient) {}

  async listRecipes(): Promise<AlchemyRecipeRecord[]> {
    const rows = await this.client.alchemyRecipe.findMany({ include: { ingredients: true }, orderBy: { id: 'asc' } });
    return rows.map(toRecipe);
  }

  async listQueue(userId: string): Promise<AlchemyJobRecord[]> {
    const rows = await this.client.alchemyJob.findMany({ where: { userId }, orderBy: [{ startsAt: 'asc' }, { queuedAt: 'asc' }] });
    return rows.map(toJob);
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

    return this.client.$transaction(async (tx) => {
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

      const latestCompletion = settled.jobs.reduce((latest, job) => Math.max(latest, job.completesAt.getTime()), input.now.getTime());
      const startsAt = new Date(Math.max(input.now.getTime(), latestCompletion));
      const completesAt = new Date(startsAt.getTime() + recipe.durationSec * 1000);
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async settleCompleted(userId: string, now: Date): Promise<AlchemyQueueOutput> {
    return this.client.$transaction(async (tx) => this.settleInTransaction(tx, userId, now), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async settleInTransaction(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<AlchemyQueueOutput> {
    const [recipeRows, jobRows] = await Promise.all([
      tx.alchemyRecipe.findMany({ include: { ingredients: true } }),
      tx.alchemyJob.findMany({ where: { userId }, orderBy: [{ startsAt: 'asc' }, { queuedAt: 'asc' }] }),
    ]);
    const recipes = new Map(recipeRows.map((row) => {
      const recipe = toRecipe(recipeRowToPlain(row));
      return [recipe.id, recipe] as const;
    }));
    const settlement = settleAlchemyQueue({ now, jobs: jobRows.map(toJob), recipes });

    for (const job of settlement.jobs) {
      await tx.alchemyJob.update({
        where: { id: job.id },
        data: { status: job.status, completedAt: job.completedAt, outputGrantedAt: job.outputGrantedAt },
      });
    }
    for (const grant of settlement.outputGrants) {
      await addPillOutput(tx, userId, grant.pillId, grant.quantity);
    }
    return { jobs: settlement.jobs, outputGrants: settlement.outputGrants };
  }
}

function recipeRowToPlain(row: RecipeRow): RecipeRow {
  return row;
}
