import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { AlchemyPlayerRecipeView, AlchemyRecipeRecord } from '../domain/alchemy/alchemy';
import { computeDurationSec, computeSuccessPct } from '../domain/alchemy/alchemy.calc';
import { buildSystemBuffs } from './attributeState';

export class ListAlchemyRecipesUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly ownedCongPhap: OwnedCongPhapRepository,
  ) {}

  async execute(): Promise<AlchemyRecipeRecord[]> {
    return (await this.alchemy.listRecipes()).filter((recipe) => recipe.active);
  }

  // View player: gắn tỉ lệ/thời gian hiệu dụng theo profile + buff Đan Đạo (Phase 2),
  // cờ locked theo rank.
  async executeForUser(userId: string): Promise<AlchemyPlayerRecipeView[]> {
    const [recipes, profile, owned] = await Promise.all([
      this.execute(),
      this.alchemy.getProfile(userId),
      this.ownedCongPhap.listByUser(userId),
    ]);
    const danDaoPct = buildSystemBuffs(owned).danDaoSuccessPct;
    return recipes.map((recipe) => ({
      ...recipe,
      effectiveSuccessPct: computeSuccessPct({
        baseSuccessPct: recipe.baseSuccessPct, rank: profile.rank, furnaceLevel: profile.furnaceLevel,
        danDaoPct,
      }),
      effectiveDurationSec: computeDurationSec({
        durationSec: recipe.durationSec, rank: profile.rank, furnaceLevel: profile.furnaceLevel,
      }),
      locked: profile.rank < recipe.minAlchemyRank,
    }));
  }
}
