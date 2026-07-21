import { describe, it, expect } from 'vitest';
import { RedeemCodeUseCase } from '../../src/application/RedeemCodeUseCase';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: `N-${id}`, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}
function code(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'c1', code: 'ABC', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 3 }], ...over };
}

function build() {
  const codes = new InMemoryRedeemCodeRepository();
  const pills = new InMemoryPillRepository();
  pills.seedPill(pill('p1'));
  return { codes, pills, uc: new RedeemCodeUseCase(codes, pills) };
}

describe('RedeemCodeUseCase', () => {
  it('grants the bundle and returns enriched rewards', async () => {
    const { codes, pills, uc } = build();
    codes.seedCode(code());
    const res = await uc.execute({ userId: 'u1', code: 'abc' }); // case-insensitive
    expect(res.rewards).toEqual([{ pillId: 'p1', name: 'N-p1', glyph: 'x', quantity: 3 }]);
    expect(codes.getInventory('u1').get('p1')).toBe(3);
    void pills;
  });

  it('rejects an unknown code with REDEEM_CODE_NOT_FOUND', async () => {
    const { uc } = build();
    await expect(uc.execute({ userId: 'u1', code: 'NOPE' })).rejects.toMatchObject({ code: 'REDEEM_CODE_NOT_FOUND' });
  });

  it('rejects an inactive code', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ active: false }));
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_INACTIVE' });
  });

  it('rejects an expired code', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_EXPIRED' });
  });

  it('rejects a second redemption by the same user', async () => {
    const { codes, uc } = build();
    codes.seedCode(code());
    await uc.execute({ userId: 'u1', code: 'ABC' });
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_ALREADY_USED' });
  });

  it('rejects once the cap is reached', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ maxRedemptions: 1 }));
    await uc.execute({ userId: 'u1', code: 'ABC' });
    await expect(uc.execute({ userId: 'u2', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_EXHAUSTED' });
  });
});
