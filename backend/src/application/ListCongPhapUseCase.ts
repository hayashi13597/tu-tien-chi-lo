import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { MaterialRepository } from '../domain/ports/MaterialRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CongPhapRecord, OwnedCongPhapEntry } from '../domain/congphap/congphap';
import { buildSystemBuffs } from './attributeState';

// Catalog entry của player view: thêm số Bí Tịch đang sở hữu (0 nếu môn không cần).
export type PlayerCatalogEntry = CongPhapRecord & { biTichOwned: number };

export interface ListCongPhapOutput {
  owned: OwnedCongPhapEntry[];
  catalog: PlayerCatalogEntry[];
  // Buff hệ thống (Phase 2) gom từ mọi môn passive đang sở hữu — drawer/breakdown đọc từ đây.
  system: { linhKhiRatePct: number; danDaoSuccessPct: number };
}

export class ListCongPhapUseCase {
  constructor(
    private readonly owned: OwnedCongPhapRepository,
    private readonly congphap: CongPhapRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(userId: string): Promise<ListCongPhapOutput> {
    // owned: giữ cả def inactive để UI hiển thị "đã bị vô hiệu"; catalog: chỉ active.
    const [owned, catalog, inventory] = await Promise.all([
      this.owned.listByUser(userId),
      this.congphap.listActive(),
      this.materials.listInventory(userId),
    ]);
    const qtyByMaterial = new Map(inventory.map((i) => [i.materialId, i.quantity]));
    // linhKhiRateMultiplier là dạng tiêu thụ-thuận tiện nội bộ; API trả pct thuần.
    const { linhKhiRateMultiplier: _ignored, ...system } = buildSystemBuffs(owned);
    return {
      owned,
      catalog: catalog.map((c) => ({ ...c, biTichOwned: c.biTichMaterialId ? (qtyByMaterial.get(c.biTichMaterialId) ?? 0) : 0 })),
      system,
    };
  }
}
