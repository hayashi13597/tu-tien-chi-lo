import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord } from '../domain/redeem/redeemCode';
import { validateRedeemCodeDefinition } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class UpdateRedeemCodeUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}

  async execute(record: RedeemCodeRecord): Promise<RedeemCodeRecord> {
    // Validate the editable fields; code is immutable so we pass the stored value.
    validateRedeemCodeDefinition({ code: record.code, maxRedemptions: record.maxRedemptions, expiresAt: record.expiresAt, rewards: record.rewards });
    const ok = await this.codes.update(record);
    if (!ok) {
      throw new DomainError('REDEEM_CODE_NOT_FOUND', `Mã id "${record.id}" không tồn tại`);
    }
    return record;
  }
}
