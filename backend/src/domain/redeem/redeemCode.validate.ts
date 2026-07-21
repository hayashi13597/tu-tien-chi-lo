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
    if (seen.has(r.pillId)) {
      throw new DomainError('INVALID_REDEEM_CODE', `duplicate reward for pill "${r.pillId}"`);
    }
    seen.add(r.pillId);
  }
  // expiresAt is intentionally unconstrained: a past date simply means the code
  // is already expired at redeem time (a runtime guard), not a config error.
}
