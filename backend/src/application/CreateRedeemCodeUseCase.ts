import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../domain/redeem/redeemCode';
import { validateRedeemCodeDefinition, normalizeCode } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class CreateRedeemCodeUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}

  async execute(input: {
    id: string;
    code: string;
    active: boolean;
    maxRedemptions: number;
    expiresAt: Date | null;
    rewards: RewardEntry[];
  }): Promise<RedeemCodeRecord> {
    const normalized = normalizeCode(input.code);
    validateRedeemCodeDefinition({ code: normalized, maxRedemptions: input.maxRedemptions, expiresAt: input.expiresAt, rewards: input.rewards });
    const existing = await this.codes.findByCode(normalized);
    if (existing) {
      throw new DomainError('REDEEM_CODE_TAKEN', `Mã "${normalized}" đã tồn tại`);
    }
    const record: RedeemCodeRecord = { ...input, code: normalized, redeemedCount: 0 };
    await this.codes.create(record);
    return record;
  }
}
