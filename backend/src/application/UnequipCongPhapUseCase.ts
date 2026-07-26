import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { DomainError } from '../domain/errors';

export class UnequipCongPhapUseCase {
  constructor(private readonly owned: OwnedCongPhapRepository) {}

  async execute(userId: string, congPhapId: string): Promise<void> {
    const ok = await this.owned.unsetSlot(userId, congPhapId);
    if (!ok) throw new DomainError('CONGPHAP_NOT_OWNED', 'Bạn chưa sở hữu công pháp này');
  }
}
