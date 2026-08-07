import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { AlchemyProfileRecord, RANK_UP_COSTS, rankUpCheck } from '../domain/alchemy/alchemy.profile';

export class RankUpAlchemyUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string): Promise<AlchemyProfileRecord> {
    const profile = await this.alchemy.getProfile(userId);
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    const targetRank = profile.rank + 1;
    rankUpCheck(profile, targetRank, character.realmMajor);
    // Repo trừ Đan Khí + bump rank trong một tx có guard, atomic với preflight trên.
    return this.alchemy.rankUp(userId, targetRank, RANK_UP_COSTS[targetRank] ?? 0);
  }
}
