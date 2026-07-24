import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { levelUpCost } from '../domain/congphap/congphap.calc';
import { DomainError } from '../domain/errors';

export class LevelUpCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
    private readonly characters: CharacterRepository,
  ) {}

  async execute(userId: string, congPhapId: string): Promise<{ level: number; linhThach: number }> {
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    const ownedEntry = await this.owned.getOne(userId, congPhapId);
    if (!ownedEntry) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
    if (!ownedEntry.def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không khả dụng');
    if (ownedEntry.level >= ownedEntry.def.maxLevel) {
      throw new DomainError('CONGPHAP_MAX_LEVEL', 'Công pháp đã đạt cấp tối đa');
    }

    const cost = levelUpCost(ownedEntry.def, ownedEntry.level);

    // Saga (giống ConsumePill): TIÊU Linh Thạch trước (atomic guard số dư), rồi
    // nâng level (optimistic guard trên level cũ). Nếu nâng thua race -> hoàn lại
    // Linh Thạch. Không transaction cross-repo trong tầng application.
    const spent = await this.characters.spendLinhThach(character.id, cost);
    if (!spent) throw new DomainError('INSUFFICIENT_LINH_THACH', 'Không đủ Linh Thạch');

    const leveled = await this.owned.levelUpGuarded(userId, congPhapId, ownedEntry.level);
    if (!leveled) {
      await this.characters.addLinhThach(character.id, cost); // bù
      throw new DomainError('CONCURRENT_MODIFICATION', 'Công pháp vừa bị thay đổi bởi request khác');
    }

    return { level: ownedEntry.level + 1, linhThach: character.linhThach - cost };
  }
}
