export interface CultivationState {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  linhKhi: number;
  linhKhiRequired: number;
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedUntil: string | null;
  cultivationRate: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: string | null; // ISO 8601
  breakthroughBonusPct: number;
}

export interface BreakthroughResult {
  success: boolean;
  character: {
    id: string;
    userId: string;
    realmMajor: number;
    realmSub: number;
    linhKhi: number;
    lastUpdateAt: string;
    breakthroughFails: number;
    punishedUntil: string | null;
    createdAt: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface ToastItem {
  id: number;
  title: string;
  message: string;
  type: "success" | "danger" | "purple" | "info";
}

export type PillRarity = 0 | 1 | 2 | 3 | 4;

export type PillEffectKind =
  | "linhKhi"
  | "cultivationBuff"
  | "breakthroughBoost"
  | "clearPunishment";

export interface PillEffect {
  kind: PillEffectKind;
  /** linhKhi: linh khí added immediately. */
  amount?: number;
  /** cultivationBuff: multiplier applied to cultivationRate while active. */
  multiplier?: number;
  /** cultivationBuff: buff lifetime in seconds. */
  durationSec?: number;
  /** breakthroughBoost: +percentage points to next breakthrough success. */
  bonusPct?: number;
}

export interface PillDef {
  id: string;
  name: string;
  glyph: string; // Hán tự shown on the pill orb
  rarity: PillRarity;
  effect: PillEffect;
  desc: string;
}

export interface InventoryPill {
  def: PillDef;
  quantity: number;
}

export interface ActiveBuff {
  kind: "cultivationBuff" | "breakthroughBoost";
  label: string;
  /** epoch ms; present for cultivationBuff only. */
  expiresAt?: number;
  multiplier?: number;
  bonusPct?: number;
}

// Flat inventory item as returned by GET /pills/inventory (backend InventoryDto).
export interface PillInventoryItem {
  id: string;
  name: string;
  glyph: string;
  rarity: PillRarity;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  quantity: number;
}
