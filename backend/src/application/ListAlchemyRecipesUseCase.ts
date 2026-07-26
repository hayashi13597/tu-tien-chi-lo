import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { AlchemyRecipeRecord } from '../domain/alchemy/alchemy';

export class ListAlchemyRecipesUseCase {
  constructor(private readonly alchemy: AlchemyRepository) {}

  async execute(): Promise<AlchemyRecipeRecord[]> {
    return (await this.alchemy.listRecipes()).filter((recipe) => recipe.active);
  }
}
