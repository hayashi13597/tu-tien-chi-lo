import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { levelUpCost } from '../domain/congphap/congphap.calc';
import { materialUpgradeCost } from '../domain/congphap/congphap.calc';
import { ProgressionRepository } from '../domain/ports/ProgressionRepository';
import { DomainError } from '../domain/errors';

export class LevelUpCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
    private readonly characters: CharacterRepository,
    private readonly progression: ProgressionRepository,
  ) {}

  async execute(userId: string, congPhapId: string): Promise<{ level: number; linhThach: number; material: { id: string; quantity: number } | null }> {
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    const ownedEntry = await this.owned.getOne(userId, congPhapId);
    if (!ownedEntry) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
    if (!ownedEntry.def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không khả dụng');
    if (ownedEntry.level >= ownedEntry.def.maxLevel) {
      throw new DomainError('CONGPHAP_MAX_LEVEL', 'Công pháp đã đạt cấp tối đa');
    }

    const cost = levelUpCost(ownedEntry.def, ownedEntry.level);
    const materialId = ownedEntry.def.upgradeMaterialId;
    const materialCost = materialUpgradeCost(ownedEntry.def, ownedEntry.level);
    const result = await this.progression.levelUpWithCosts({
      userId,
      congPhapId,
      expectedLevel: ownedEntry.level,
      linhThachCost: cost,
      materialId,
      materialCost,
    });

    if (result.kind === 'insufficient-linh-thach') throw new DomainError('INSUFFICIENT_LINH_THACH', 'Không đủ Linh Thạch');
    if (result.kind === 'insufficient-materials') throw new DomainError('INSUFFICIENT_MATERIALS', 'Không đủ nguyên liệu');
    if (result.kind === 'concurrent') throw new DomainError('CONCURRENT_MODIFICATION', 'Công pháp vừa bị thay đổi bởi request khác');

    return {
      level: result.level,
      linhThach: result.linhThach,
      material: materialId ? { id: materialId, quantity: result.materialQuantity } : null,
    };
  }
}
