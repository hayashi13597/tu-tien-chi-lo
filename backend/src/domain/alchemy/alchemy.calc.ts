import { DomainError } from '../errors';
import { AlchemyJobRecord, AlchemyRecipeRecord, AlchemySettlement } from './alchemy';

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

export function settleAlchemyQueue(input: {
  now: Date;
  jobs: readonly AlchemyJobRecord[];
  recipes: ReadonlyMap<string, AlchemyRecipeRecord>;
}): AlchemySettlement {
  const jobs = [...input.jobs]
    .map((job) => ({ ...job }))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.queuedAt.getTime() - b.queuedAt.getTime() || a.id.localeCompare(b.id));
  const completedJobIds: string[] = [];
  const outputGrants = [] as AlchemySettlement['outputGrants'];

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
      outputGrants.push({ pillId: recipe.pillId, quantity: job.quantity });
      job.outputGrantedAt = input.now;
    }
  }

  let nextRunning = jobs.find((job) => job.status === 'running') ?? null;
  if (!nextRunning) {
    nextRunning = jobs.find((job) => job.status === 'queued' && job.startsAt.getTime() <= input.now.getTime()) ?? null;
    if (nextRunning) nextRunning.status = 'running';
  }

  return { jobs, completedJobIds, nextRunning, outputGrants };
}
