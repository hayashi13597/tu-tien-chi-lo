import { DomainError } from '../domain/errors';
import { AlchemyCatalogAdminRepository } from '../domain/ports/AlchemyCatalogAdminRepository';
import { AlchemyRecipeRecord } from '../domain/alchemy/alchemy';

export class UpdateAlchemyRecipeAdminUseCase {
  constructor(private readonly repo: AlchemyCatalogAdminRepository) {}

  async execute(rows: readonly AlchemyRecipeRecord[]): Promise<AlchemyRecipeRecord[]> {
    const recipeIds = new Set<string>();
    for (const recipe of rows) {
      if (!recipe.id || recipeIds.has(recipe.id) || !recipe.pillId || !Number.isInteger(recipe.durationSec) || recipe.durationSec <= 0 ||
          !Number.isInteger(recipe.linhThachCost) || recipe.linhThachCost < 0 || recipe.ingredients.length === 0) {
        throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid recipe: ${recipe.id}`);
      }
      recipeIds.add(recipe.id);
      const ingredientIds = new Set<string>();
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.materialId || ingredientIds.has(ingredient.materialId) || !Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0) {
          throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid ingredients in recipe: ${recipe.id}`);
        }
        ingredientIds.add(ingredient.materialId);
      }
    }
    return this.repo.replace(rows);
  }
}
