import { DomainError } from '../errors';
import { RandomSource } from '../ports/RandomSource';

export interface AlchemyProfileRecord {
  id: string;
  userId: string;
  characterId: string;
  rank: number;        // 1..MAX_RANK (7-9 để phase Thiên Giai)
  danKhi: number;
  furnaceLevel: number; // 1..5
}

// Phase 1 mở tới cấp 6; 7-9 (tier 3 + Đan Hỏa Tủy) chờ nội dung Bí Cảnh 2.0.
export const MAX_RANK = 6;

export const RANK_UP_COSTS: Readonly<Record<number, number>> = { 2: 100, 3: 300, 4: 700, 5: 1300, 6: 2100 };
// realmMajor tối thiểu để lên cấp tương ứng (Kết Đan = 3, Hóa Thần = 6).
export const RANK_REALM_GATES: Readonly<Record<number, number>> = { 4: 3, 7: 6 };

export const FURNACE_UPGRADES: Readonly<Record<number, { danKhi: number; linhThach: number }>> = {
  2: { danKhi: 50, linhThach: 200 },
  3: { danKhi: 150, linhThach: 600 },
  4: { danKhi: 350, linhThach: 1400 },
  5: { danKhi: 700, linhThach: 3000 },
};

export const DAN_KHI_TABLE: Readonly<Record<number, { success: number; fail: number }>> = {
  1: { success: 2, fail: 1 },
  2: { success: 5, fail: 2 },
  3: { success: 10, fail: 4 },
};

export const CRIT_CHANCE = 0.1; // 10% đơn vị thành công cho x2 output
export const SUCCESS_PCT_MIN = 5;  // luôn giữ ít nhất 5% cho recipe có base thật
export const SUCCESS_PCT_MAX = 95; // recipe non-deterministic không bao giờ chắc chắn 100%

export const rankSuccessPct = (rank: number): number => (rank - 1) * 3;
export const rankSpeedPct = (rank: number): number => (rank - 1) * 2;
export const furnaceSuccessPct = (level: number): number => (level - 1) * 4;
export const furnaceSpeedPct = (level: number): number => (level - 1) * 4;

// Hoàn lại cho mỗi đơn vị hỏng: floor(30% phí Linh Thạch recipe).
export const failRefundPerUnit = (linhThachCost: number): number => Math.floor(linhThachCost * 0.3);

export function danKhiForJob(input: { tier: number; successCount: number; failCount: number }): number {
  const table = DAN_KHI_TABLE[input.tier] ?? DAN_KHI_TABLE[1];
  return input.successCount * table.success + input.failCount * table.fail;
}

export interface JobOutcome {
  successCount: number;
  failCount: number;
  critCount: number;
  grantQuantity: number; // successCount + critCount (mỗi crit x2 cho 1 đơn vị)
}

// Roll độc lập từng đơn vị: roll1 < successPct% → thành công; roll2 < CRIT → xuất sắc.
export function rollJobOutcome(input: {
  quantity: number;
  successPct: number;
  random: RandomSource;
}): JobOutcome {
  let successCount = 0;
  let failCount = 0;
  let critCount = 0;
  for (let unit = 0; unit < input.quantity; unit += 1) {
    if (input.random.next() * 100 < input.successPct) {
      successCount += 1;
      if (input.random.next() < CRIT_CHANCE) critCount += 1;
    } else {
      failCount += 1;
    }
  }
  return { successCount, failCount, critCount, grantQuantity: successCount + critCount };
}

// Trả null khi hợp lệ; throw DomainError với code tương ứng khi không.
export function rankUpCheck(
  profile: Pick<AlchemyProfileRecord, 'rank' | 'danKhi'>,
  targetRank: number,
  realmMajor = 0,
): null {
  if (!Number.isInteger(targetRank) || targetRank !== profile.rank + 1) {
    throw new DomainError('ALCHEMY_RANK_INVALID', `target rank phải là cấp kế tiếp: ${profile.rank + 1}`);
  }
  if (targetRank > MAX_RANK) {
    throw new DomainError('ALCHEMY_RANK_LOCKED', 'cấp Đan Sư 7-9 mở cùng nội dung Thiên Giai (phase sau)');
  }
  const gateRealm = RANK_REALM_GATES[targetRank];
  if (gateRealm !== undefined && realmMajor < gateRealm) {
    // Gameplay denial (đủ Đan Khí nhưng chưa đủ cảnh giới) → errorHandler map 409.
    throw new DomainError('ALCHEMY_REALM_GATE', `cần cảnh giới tối thiểu Kết Đan (realmMajor ${gateRealm})`);
  }
  const cost = RANK_UP_COSTS[targetRank];
  if (cost !== undefined && profile.danKhi < cost) {
    throw new DomainError('INSUFFICIENT_DAN_KHI', `cần ${cost} Đan Khí để lên Đan Sư cấp ${targetRank}`);
  }
  return null;
}

export function furnaceUpgradeCheck(
  profile: Pick<AlchemyProfileRecord, 'furnaceLevel' | 'danKhi'>,
  targetLevel: number,
): null {
  if (!Number.isInteger(targetLevel) || targetLevel !== profile.furnaceLevel + 1 || targetLevel > 5) {
    // Request sai thứ tự/vượt cap lò → errorHandler map 400.
    throw new DomainError('ALCHEMY_FURNACE_INVALID', `cấp lò kế tiếp phải là ${profile.furnaceLevel + 1}`);
  }
  const cost = FURNACE_UPGRADES[targetLevel];
  if (cost && profile.danKhi < cost.danKhi) {
    throw new DomainError('INSUFFICIENT_DAN_KHI', `cần ${cost.danKhi} Đan Khí để nâng Đan Lô cấp ${targetLevel}`);
  }
  return null;
}
