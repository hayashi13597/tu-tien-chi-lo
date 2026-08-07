import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { ProgressionRepository } from '../domain/ports/ProgressionRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';
import { DomainError } from '../domain/errors';
import { learnGate, LEARN_LINH_THACH_COST } from '../domain/congphap/congphap.calc';

// Học công pháp bằng Bí Tịch (Phase 2): 1 Bí Tịch + LEARN_LINH_THACH_COST Linh Thạch.
// Gate (biTich/cảnh giới) ở domain; chi tiêu + chống race ở ProgressionRepository tx.
export class LearnCongPhapUseCase {
  constructor(
    private readonly congphap: CongPhapRepository,
    private readonly progression: ProgressionRepository,
    private readonly characters: CharacterRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}

  async execute(userId: string, congPhapId: string): Promise<{
    owned: string;
    linhThach: number;
    biTich: { id: string; quantity: number };
  }> {
    const def = await this.congphap.findById(congPhapId);
    if (!def || !def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không tồn tại');
    const character = await this.characters.findByUserId(userId);
    if (!character) throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');

    const gate = learnGate(def, character.realmMajor);
    if (!gate.ok && gate.reason === 'not-learnable') {
      throw new DomainError('CONGPHAP_NOT_LEARNABLE', 'Môn này chỉ nhận được qua nguồn khác');
    }
    if (!gate.ok) {
      const realmName = this.realmConfig.get().realmName(def.minRealmMajor);
      throw new DomainError('CONGPHAP_REALM_GATE', `Cần đạt cảnh giới ${realmName}`);
    }

    const result = await this.progression.learnWithCosts({
      userId,
      congPhapId,
      biTichMaterialId: def.biTichMaterialId as string,
      linhThachCost: LEARN_LINH_THACH_COST,
    });
    if (result.kind === 'missing-bitich') throw new DomainError('CONGPHAP_MISSING_BITICH', 'Thiếu Bí Tịch của môn công pháp');
    if (result.kind === 'insufficient-linh-thach') throw new DomainError('INSUFFICIENT_LINH_THACH', 'Không đủ Linh Thạch');
    if (result.kind === 'already-owned') throw new DomainError('CONGPHAP_ALREADY_OWNED', 'Bạn đã sở hữu công pháp này');
    if (result.kind === 'concurrent') throw new DomainError('CONCURRENT_MODIFICATION', 'Thao tác bị xung đột, thử lại');

    return { owned: def.id, linhThach: result.linhThach, biTich: { id: def.biTichMaterialId as string, quantity: result.biTichQuantity } };
  }
}
