import { MaterialSpendLine } from '../materials/material';
import { AlchemyProfileRecord } from './alchemy.profile';

export type AlchemyJobStatus = 'queued' | 'running' | 'completed';

export interface AlchemyIngredientLine extends MaterialSpendLine {}

export interface AlchemyRecipeRecord {
  id: string;
  pillId: string;
  durationSec: number;
  linhThachCost: number;
  active: boolean;
  tier: number;          // 1..3 (Phàm/Linh/Thiên Giai)
  minAlchemyRank: number; // 1 / 4 / 7 theo tier
  baseSuccessPct: number; // 5..100 (tier 1 = 100 → deterministic như cũ)
  ingredients: AlchemyIngredientLine[];
}

export interface AlchemyJobRecord {
  id: string;
  userId: string;
  characterId: string;
  recipeId: string;
  quantity: number;
  queuedAt: Date;
  startsAt: Date;
  completesAt: Date;
  completedAt: Date | null;
  outputGrantedAt: Date | null;
  status: AlchemyJobStatus;
  successCount: number;
  failCount: number;
  critCount: number;
}

// View cho player route: recipe + số hiển thị tính theo profile người gọi.
export interface AlchemyPlayerRecipeView extends AlchemyRecipeRecord {
  effectiveSuccessPct: number;
  effectiveDurationSec: number;
  locked: boolean;
}

export interface AlchemyOutputGrant {
  pillId: string;
  quantity: number;
}

export interface AlchemyQueueOutput {
  jobs: AlchemyJobRecord[];
  outputGrants: AlchemyOutputGrant[];
}

export interface AlchemySettlement extends AlchemyQueueOutput {
  completedJobIds: string[];
  nextRunning: AlchemyJobRecord | null;
  danKhiGain: number;       // tổng Đan Khí sinh ra trong lần settle này
  linhThachRefund: number;  // tổng refund 30% từ đơn vị hỏng
  profile: AlchemyProfileRecord; // profile sau cộng Đan Khí
}
