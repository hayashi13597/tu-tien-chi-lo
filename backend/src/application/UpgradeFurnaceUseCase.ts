import { AlchemyRepository } from '../domain/ports/AlchemyRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { AlchemyProfileRecord, FURNACE_UPGRADES, furnaceUpgradeCheck } from '../domain/alchemy/alchemy.profile';

export class UpgradeFurnaceUseCase {
  constructor(
    private readonly alchemy: AlchemyRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string): Promise<AlchemyProfileRecord> {
    const profile = await this.alchemy.getProfile(userId);
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', `character not found for user: ${userId}`);
    const targetLevel = profile.furnaceLevel + 1;
    furnaceUpgradeCheck(profile, targetLevel);
    const cost = FURNACE_UPGRADES[targetLevel];
    if (character.linhThach < cost.linhThach) {
      throw new DomainError('INSUFFICIENT_LINH_THACH', 'not enough Linh Thạch');
    }
    // Repo trừ Đan Khí + Linh Thạch và bump lò trong một tx có guard.
    return this.alchemy.upgradeFurnace({
      userId, characterId: character.id, targetLevel,
      danKhiCost: cost.danKhi, linhThachCost: cost.linhThach,
    });
  }
}
