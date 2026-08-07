import { CongPhapRecord } from './congphap';
import { materialCostAtLevel } from '../materials/material.calc';

// Chi phí Linh Thạch để đi từ currentLevel -> currentLevel+1. Level bắt đầu = 1,
// nên level 1->2 = baseCost * costGrowth^0 = baseCost. Lũy tiến hình học theo level.
export function levelUpCost(def: CongPhapRecord, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel - 1));
}

// Linh Thạch quy đổi khi redeem cấp công pháp đã sở hữu. Mặc định = baseCost.
export function duplicateRefund(def: CongPhapRecord): number {
  return def.dupRefundLinhThach ?? def.baseCost;
}

export function materialUpgradeCost(def: CongPhapRecord, currentLevel: number): number {
  if (!def.upgradeMaterialId) return 0;
  return materialCostAtLevel(def.baseMaterialCost, def.materialCostGrowth, currentLevel);
}

// Học môn qua Bí Tịch: giá Linh Thạch phẳng theo spec Phase 2 (mọi môn tier 2 = 300).
export const LEARN_LINH_THACH_COST = 300;

export type LearnGateResult = { ok: true } | { ok: false; reason: 'not-learnable' | 'realm-gate' };

// Gate học môn bằng Bí Tịch: môn không gắn Bí Tịch chỉ nhận qua redeem/grant.
export function learnGate(def: CongPhapRecord, realmMajor: number): LearnGateResult {
  if (def.biTichMaterialId === null) return { ok: false, reason: 'not-learnable' };
  if (realmMajor < def.minRealmMajor) return { ok: false, reason: 'realm-gate' };
  return { ok: true };
}
