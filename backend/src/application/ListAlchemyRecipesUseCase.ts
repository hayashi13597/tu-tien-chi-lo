import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { AlchemyPlayerRecipeView, AlchemyRecipeRecord } from '../domain/alchemy/alchemy';
import { computeDurationSec, computeSuccessPct } from '../domain/alchemy/alchemy.calc';

export class ListAlchemyRecipesUseCase {
  constructor(private readonly alchemy: AlchemyRepository) {}

  async execute(): Promise<AlchemyRecipeRecord[]> {
    return (await this.alchemy.listRecipes()).filter((recipe) => recipe.active);
  }

  // View player: gắn tỉ lệ/thời gian hiệu dụng theo profile và cờ locked theo rank.
  async executeForUser(userId: string): Promise<AlchemyPlayerRecipeView[]> {
    const [recipes, profile] = await Promise.all([this.execute(), this.alchemy.getProfile(userId)]);
    return recipes.map((recipe) => ({
      ...recipe,
      effectiveSuccessPct: computeSuccessPct({
        baseSuccessPct: recipe.baseSuccessPct, rank: profile.rank, furnaceLevel: profile.furnaceLevel,
      }),
      effectiveDurationSec: computeDurationSec({
        durationSec: recipe.durationSec, rank: profile.rank, furnaceLevel: profile.furnaceLevel,
      }),
      locked: profile.rank < recipe.minAlchemyRank,
    }));
  }
}
