import { AttributeSet } from '../attributes/attributes';

export type PillEffectKind =
  | 'linhKhi'
  | 'cultivationBuff'
  | 'breakthroughBoost'
  | 'clearPunishment'
  // Phase 3 — đan combat: chỉ dùng qua loadout bí cảnh, không consume trực tiếp.
  | 'combatBuff';

export interface PillRecord {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  // Bậc đan dược 1..3 (Phàm/Linh/Thiên Giai) — đồng nhất với material/recipe.
  tier: number;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  // Phase 3 combatBuff: attribute bị buff trong simulateBattle + thời điểm kích.
  combatAttribute: keyof AttributeSet | null;
  combatTrigger: 'start' | 'lowHp30' | null;
  desc: string;
  // Soft-disable flag: inactive pills are invisible/unusable to players but
  // keep their InventoryItem rows (see spec: removal is never a hard delete).
  active: boolean;
  // Units granted to a newly registered user; 0 = not in the starter kit.
  starterQuantity: number;
}

export interface InventoryEntry {
  pill: PillRecord;
  quantity: number;
}
