import { CongPhapRecord } from './congphap';

// Chi phí Linh Thạch để đi từ currentLevel -> currentLevel+1. Level bắt đầu = 1,
// nên level 1->2 = baseCost * costGrowth^0 = baseCost. Lũy tiến hình học theo level.
export function levelUpCost(def: CongPhapRecord, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel - 1));
}

// Linh Thạch quy đổi khi redeem cấp công pháp đã sở hữu. Mặc định = baseCost.
export function duplicateRefund(def: CongPhapRecord): number {
  return def.dupRefundLinhThach ?? def.baseCost;
}
