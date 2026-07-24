import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRecord, OwnedCongPhapEntry } from '../domain/congphap/congphap';

export class ListCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
  ) {}

  async execute(userId: string): Promise<{ owned: OwnedCongPhapEntry[]; catalog: CongPhapRecord[] }> {
    // owned: giữ cả def inactive để UI hiển thị "đã bị vô hiệu"; catalog: chỉ active.
    const [owned, catalog] = await Promise.all([this.owned.listByUser(userId), this.congphap.listActive()]);
    return { owned, catalog };
  }
}
