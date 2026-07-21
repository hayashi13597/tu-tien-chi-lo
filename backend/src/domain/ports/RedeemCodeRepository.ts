import { RedeemCodeRecord, RewardEntry } from '../redeem/redeemCode';

export type ReserveResult = 'ok' | 'already_redeemed' | 'exhausted';

export interface RedeemCodeRepository {
  findByCode(code: string): Promise<RedeemCodeRecord | null>;
  listAll(): Promise<RedeemCodeRecord[]>;
  create(record: RedeemCodeRecord): Promise<void>;
  // Full-row overwrite by id (rewards replaced wholesale). Returns false on unknown id.
  update(record: RedeemCodeRecord): Promise<boolean>;
  // Atomic per-user-once + cap guard. See PrismaRedeemCodeRepository for the
  // DB-enforced implementation; the result tells the use case which error to throw.
  tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult>;
  // Additive grant into inventory (increment-or-create), like seedStarterInventory.
  grantRewards(userId: string, rewards: RewardEntry[]): Promise<void>;
}
