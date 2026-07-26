import { PassiveEffect } from '../attributes/attributes.calc';

export type CongPhapCategory = 'active' | 'passive';

// Số slot công pháp chủ động cố định (spec: 4).
export const ACTIVE_SLOTS = 4;

export interface CongPhapRecord {
  id: string;            // slug ^[a-z0-9-]+$
  name: string;
  glyph: string;
  rarity: number;
  category: CongPhapCategory;
  desc: string;
  active: boolean;       // soft-disable
  maxLevel: number;      // >= 1
  baseCost: number;      // Linh Thạch cho level 1->2 (>= 0)
  costGrowth: number;    // >= 1
  // Bị động: >= 1 effect. Chủ động: null.
  effects: PassiveEffect[] | null;
  // Chủ động: skill power = powerPerLevel * level (> 0). Bị động: null.
  powerPerLevel: number | null;
  chanNguyenCost: number | null;   // chủ động, để dành combat
  dupRefundLinhThach: number | null;
  upgradeMaterialId: string | null;
  baseMaterialCost: number;
  materialCostGrowth: number;
  cooldownRounds: number | null;
}

// Một công pháp người chơi sở hữu (kèm định nghĩa).
export interface OwnedCongPhapEntry {
  def: CongPhapRecord;
  level: number;
  equippedSlot: number | null;
}
