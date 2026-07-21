import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { RedeemResultDto } from '../domain/redeem/redeemCode';
import { normalizeCode } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class RedeemCodeUseCase {
  constructor(
    private readonly codes: RedeemCodeRepository,
    private readonly pills: PillRepository,
  ) {}

  async execute(input: { userId: string; code: string }): Promise<RedeemResultDto> {
    const code = await this.codes.findByCode(normalizeCode(input.code));
    if (!code) {
      throw new DomainError('REDEEM_CODE_NOT_FOUND', 'Mã không tồn tại');
    }
    if (!code.active) {
      throw new DomainError('REDEEM_CODE_INACTIVE', 'Mã đã bị vô hiệu hóa');
    }
    if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
      throw new DomainError('REDEEM_CODE_EXPIRED', 'Mã đã hết hạn');
    }

    // Reserve BEFORE granting: the reservation is the single source of truth for
    // "this user gets the bundle exactly once", so a lost cap race never grants.
    const reserved = await this.codes.tryReserveRedemption(code.id, input.userId, code.maxRedemptions);
    if (reserved === 'already_redeemed') {
      throw new DomainError('REDEEM_CODE_ALREADY_USED', 'Bạn đã đổi mã này rồi');
    }
    if (reserved === 'exhausted') {
      throw new DomainError('REDEEM_CODE_EXHAUSTED', 'Mã đã hết lượt đổi');
    }

    await this.codes.grantRewards(input.userId, code.rewards);

    // Enrich each reward with the pill's name/glyph for the success toast. A pill
    // hard-deleted after the code was authored falls back to its id (still granted).
    const rewards = await Promise.all(
      code.rewards.map(async (r) => {
        const pill = await this.pills.findById(r.pillId);
        return { pillId: r.pillId, name: pill?.name ?? r.pillId, glyph: pill?.glyph ?? '?', quantity: r.quantity };
      }),
    );
    return { rewards };
  }
}
