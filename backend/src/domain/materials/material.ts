export type MaterialKind = 'branch-alchemy' | 'congphap-upgrade';

export interface MaterialRecord {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  // Bậc nguyên liệu 1..3 (Phàm/Linh/Thiên Giai) — đồng nhất với pill/recipe.
  tier: number;
  description: string;
  active: boolean;
}

export interface MaterialInventoryRecord {
  materialId: string;
  quantity: number;
  material?: MaterialRecord;
}

export interface MaterialSpendLine {
  materialId: string;
  quantity: number;
}

export interface ExpeditionDailyQuotaRecord {
  gameDay: string;
  spentUnits: number;
}
