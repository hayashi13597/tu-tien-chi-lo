import { RedeemCodeRepository, ReserveResult } from '../../src/domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../../src/domain/redeem/redeemCode';
import { normalizeCode } from '../../src/domain/redeem/redeemCode.validate';

export class InMemoryRedeemCodeRepository implements RedeemCodeRepository {
  private codes = new Map<string, RedeemCodeRecord>(); // key: id
  private redemptions = new Set<string>(); // key: `${codeId}:${userId}`
  private inv = new Map<string, Map<string, number>>(); // userId -> (pillId -> qty)

  seedCode(record: RedeemCodeRecord): void {
    this.codes.set(record.id, record);
  }

  getInventory(userId: string): Map<string, number> {
    return this.inv.get(userId) ?? new Map();
  }

  async findByCode(code: string): Promise<RedeemCodeRecord | null> {
    const target = normalizeCode(code);
    for (const c of this.codes.values()) {
      if (normalizeCode(c.code) === target) return c;
    }
    return null;
  }

  async listAll(): Promise<RedeemCodeRecord[]> {
    return [...this.codes.values()];
  }

  async create(record: RedeemCodeRecord): Promise<void> {
    this.codes.set(record.id, record);
  }

  async update(record: RedeemCodeRecord): Promise<boolean> {
    if (!this.codes.has(record.id)) return false;
    this.codes.set(record.id, record);
    return true;
  }

  async tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult> {
    const key = `${codeId}:${userId}`;
    if (this.redemptions.has(key)) return 'already_redeemed';
    const c = this.codes.get(codeId);
    if (!c || c.redeemedCount >= maxRedemptions) return 'exhausted';
    this.redemptions.add(key);
    c.redeemedCount += 1;
    return 'ok';
  }

  async grantRewards(userId: string, rewards: RewardEntry[]): Promise<void> {
    const bag = this.inv.get(userId) ?? new Map<string, number>();
    for (const r of rewards) {
      bag.set(r.pillId, (bag.get(r.pillId) ?? 0) + r.quantity);
    }
    this.inv.set(userId, bag);
  }
}
