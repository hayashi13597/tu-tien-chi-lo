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
}

export interface InventoryEntry {
  pill: PillRecord;
  quantity: number;
}
