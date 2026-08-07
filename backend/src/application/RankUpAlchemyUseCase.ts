import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { MaterialRepository } from '../domain/ports/MaterialRepository';
import { AlchemyProfileRecord, RANK_DAN_HOA_TUY_COSTS, RANK_UP_COSTS, rankUpCheck } from '../domain/alchemy/alchemy.profile';

export class RankUpAlchemyUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly characters: CharacterRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(userId: string): Promise<AlchemyProfileRecord> {
    const profile = await this.alchemy.getProfile(userId);
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    const targetRank = profile.rank + 1;
    const tuyOwned = (await this.materials.listInventory(userId)).find((entry) => entry.materialId === 'dan-hoa-tuy')?.quantity ?? 0;
    rankUpCheck(profile, targetRank, character.realmMajor, tuyOwned);
    // Repo trừ Đan Khí + Đan Hỏa Tủy (cấp 7-9) + bump rank atomic trong một tx.
    return this.alchemy.rankUp(userId, targetRank, RANK_UP_COSTS[targetRank] ?? 0, RANK_DAN_HOA_TUY_COSTS[targetRank] ?? 0);
  }
}
