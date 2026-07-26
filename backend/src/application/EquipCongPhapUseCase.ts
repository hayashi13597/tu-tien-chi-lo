import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { ACTIVE_SLOTS } from '../domain/congphap/congphap';
import { DomainError } from '../domain/errors';

export class EquipCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
  ) {}

  async execute(userId: string, congPhapId: string, slot: number): Promise<void> {
    if (!Number.isInteger(slot) || slot < 0 || slot >= ACTIVE_SLOTS) {
      throw new DomainError('CONGPHAP_SLOT_INVALID', `slot must be an integer in [0, ${ACTIVE_SLOTS})`);
    }
    const owned = await this.owned.getOne(userId, congPhapId);
    if (!owned) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
    // Chỉ công pháp chủ động (còn active) mới trang bị vào slot.
    if (owned.def.category !== 'active') throw new DomainError('CONGPHAP_NOT_EQUIPPABLE', 'Chỉ công pháp chủ động mới trang bị được');
    if (!owned.def.active) throw new DomainError('CONGPHAP_NOT_FOUND', 'Công pháp không khả dụng');

    // Dọn slot trước (thay công pháp đang chiếm slot), rồi gán — 1 công pháp/slot.
    await this.owned.clearSlot(userId, slot);
    const ok = await this.owned.setSlot(userId, congPhapId, slot);
    if (!ok) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
  }
}
