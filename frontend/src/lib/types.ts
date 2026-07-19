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
  /** Success chance (%) the next breakthrough would use: base + pity + boost. */
  breakthroughSuccessRate: number;
}

export interface Me {
  id: string;
  username: string;
  role: string;
}

export interface RealmDistributionEntry {
  realmMajor: number;
  realmName: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  realmDistribution: RealmDistributionEntry[];
  punishedCount: number;
}

export interface SubStageConfigDTO {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

export interface RealmConfigDTO {
  name: string;
  subStages: SubStageConfigDTO[];
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

// Full pill definition as the admin catalog editor sees it (GET/POST/PUT
// /admin/pills). Unlike PillInventoryItem, this carries the admin-only
// fields: active (soft-disable) and starterQuantity (new-player grant).
export interface AdminPillDTO {
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
  active: boolean;
  starterQuantity: number;
}
