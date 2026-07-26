import { DomainError } from '../errors';
import { RewardEntry } from './redeemCode';

// Case-insensitive matching: the same normalization runs at create AND lookup,
// so what an admin types and what a player types compare equal regardless of case.
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateRedeemCodeDefinition(input: {
  code: string;
  maxRedemptions: number;
  expiresAt: Date | null;
  rewards: RewardEntry[];
}): void {
  if (normalizeCode(input.code) === '') {
    throw new DomainError('INVALID_REDEEM_CODE', 'code must not be empty');
  }
  if (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1) {
    throw new DomainError('INVALID_REDEEM_CODE', 'maxRedemptions must be an integer >= 1');
  }
  if (input.rewards.length === 0) {
    throw new DomainError('INVALID_REDEEM_CODE', 'a code must grant at least one reward');
  }
  const seen = new Set<string>();
  for (const r of input.rewards) {
    if (!Number.isInteger(r.quantity) || r.quantity < 1) {
      throw new DomainError('INVALID_REDEEM_CODE', 'each reward quantity must be an integer >= 1');
    }
    // Một reward mang đúng MỘT loại (pill | congphap | linhThach) — cùng bất biến
    // với cột nullable trên RedeemCodeReward. Không loại nào hoặc nhiều hơn một
    // loại đều khiến grant mơ hồ, nên chặn ngay lúc tạo/sửa code.
    const kinds = [r.pillId !== undefined, r.congPhapId !== undefined, r.linhThach !== undefined].filter(Boolean).length;
    if (kinds !== 1) {
      throw new DomainError('INVALID_REDEEM_CODE', 'each reward must set exactly one of pillId, congPhapId, linhThach');
    }
    if (r.linhThach !== undefined && (!Number.isInteger(r.linhThach) || r.linhThach < 1)) {
      throw new DomainError('INVALID_REDEEM_CODE', 'linhThach reward must be an integer >= 1');
    }
    // Khóa trùng lặp gắn theo loại: pill "p1" và công pháp "p1" là hai thứ khác nhau.
    const key = r.pillId !== undefined ? `pill:${r.pillId}`
      : r.congPhapId !== undefined ? `congphap:${r.congPhapId}`
        : 'linhThach';
    if (seen.has(key)) {
      throw new DomainError('INVALID_REDEEM_CODE', `duplicate reward "${key}"`);
    }
    seen.add(key);
  }
  // expiresAt is intentionally unconstrained: a past date simply means the code
  // is already expired at redeem time (a runtime guard), not a config error.
}
