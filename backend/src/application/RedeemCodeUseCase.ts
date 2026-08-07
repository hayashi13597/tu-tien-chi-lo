import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { CongPhapRepository } from '../domain/ports/CongPhapRepository';
import { OwnedCongPhapRepository } from '../domain/ports/OwnedCongPhapRepository';
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { MaterialRepository } from '../domain/ports/MaterialRepository';
import { RedeemResultDto, RedeemRewardResult } from '../domain/redeem/redeemCode';
import { normalizeCode } from '../domain/redeem/redeemCode.validate';
import { duplicateRefund } from '../domain/congphap/congphap.calc';
import { DomainError } from '../domain/errors';

export class RedeemCodeUseCase {
  constructor(
    private readonly codes: RedeemCodeRepository,
    private readonly pills: PillRepository,
    private readonly congphap: CongPhapRepository,
    private readonly owned: OwnedCongPhapRepository,
    private readonly characters: CharacterRepository,
    private readonly materials: MaterialRepository,
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

    // Linh Thạch (cấp thẳng lẫn hoàn khi công pháp trùng) ghi lên Character.
    const character = await this.characters.findByUserId(input.userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const results: RedeemRewardResult[] = [];
    for (const r of code.rewards) {
      if (r.pillId) {
        // Đường cũ: cộng dồn vào inventory (increment-or-create).
        await this.codes.grantRewards(input.userId, [{ pillId: r.pillId, quantity: r.quantity }]);
        const pill = await this.pills.findById(r.pillId);
        results.push({ kind: 'pill', id: r.pillId, name: pill?.name ?? r.pillId, glyph: pill?.glyph ?? '?', quantity: r.quantity });
      } else if (r.congPhapId) {
        const def = await this.congphap.findById(r.congPhapId);
        const isNew = await this.owned.grant(input.userId, r.congPhapId);
        if (isNew) {
          results.push({ kind: 'congphap', id: r.congPhapId, name: def?.name ?? r.congPhapId, glyph: def?.glyph ?? '?', quantity: 1 });
        } else {
          // Đã sở hữu -> quy đổi thành Linh Thạch (spec).
          const refund = def ? duplicateRefund(def) : 0;
          if (refund > 0) await this.characters.addLinhThach(character.id, refund);
          results.push({ kind: 'linhThach', id: 'linh-thach', name: 'Linh Thạch', glyph: '晶', quantity: refund });
        }
      } else if (r.materialId) {
        // Reward vật phẩm (Phase 2 — tạm thời là đường phát Bí Tịch trước khi boss drop).
        await this.materials.increment(input.userId, r.materialId, r.quantity);
        const material = await this.materials.getById(r.materialId);
        results.push({ kind: 'material', id: r.materialId, name: material?.name ?? r.materialId, glyph: material?.glyph ?? '?', quantity: r.quantity });
      } else if (r.linhThach) {
        await this.characters.addLinhThach(character.id, r.linhThach);
        results.push({ kind: 'linhThach', id: 'linh-thach', name: 'Linh Thạch', glyph: '晶', quantity: r.linhThach });
      }
    }
    return { rewards: results };
  }
}
