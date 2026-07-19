export type PillEffectKind =
  | 'linhKhi'
  | 'cultivationBuff'
  | 'breakthroughBoost'
  | 'clearPunishment';

export interface PillRecord {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
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
