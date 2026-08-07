import { DomainError } from '../domain/errors';
import { AlchemyCatalogAdminRepository } from '../domain/ports/AlchemyCatalogAdminRepository';
import { AlchemyRecipeRecord } from '../domain/alchemy/alchemy';
import { validateRecipe } from '../domain/alchemy/alchemy.calc';

export class UpdateAlchemyRecipeAdminUseCase {
  constructor(private readonly repo: AlchemyCatalogAdminRepository) {}

  async execute(rows: readonly AlchemyRecipeRecord[]): Promise<AlchemyRecipeRecord[]> {
    const recipeIds = new Set<string>();
    for (const recipe of rows) {
      // Rule từng recipe (shape, nguyên liệu, tier/minAlchemyRank/baseSuccessPct)
      // sống duy nhất ở domain validateRecipe — ném DomainError
      // ALCHEMY_RECIPE_INVALID, giữ nguyên error code cũ của use case này.
      validateRecipe(recipe);
      // Check liên-catalog (id trùng) là trách nhiệm của use case, không phải domain.
      if (recipeIds.has(recipe.id)) {
        throw new DomainError('ALCHEMY_RECIPE_INVALID', `invalid recipe: ${recipe.id}`);
      }
      recipeIds.add(recipe.id);
    }
    return this.repo.replace(rows);
  }
}
