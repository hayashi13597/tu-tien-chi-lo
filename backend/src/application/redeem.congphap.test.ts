import { describe, it, expect } from 'vitest';
import { RedeemCodeUseCase } from './RedeemCodeUseCase';
import { CongPhapRecord } from '../domain/congphap/congphap';
import { RewardEntry } from '../domain/redeem/redeemCode';

const cp: CongPhapRecord = { id: 'cp1', name: 'CP', glyph: 'c', rarity: 2, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: 250, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null };

function build(rewards: RewardEntry[], ownedAlready: string[] = []) {
  let refund = 0;
  const granted: string[] = [];
  const owned = new Set(ownedAlready);
  const codes = {
    findByCode: async () => ({ id: 'code', code: 'X', active: true, maxRedemptions: 10, redeemedCount: 0, expiresAt: null, rewards }),
    tryReserveRedemption: async () => 'ok',
    grantRewards: async () => {}, // pill path cũ — không dùng ở test này
  };
  const pills = { findById: async () => null };
  const congphap = { findById: async (id: string) => (id === 'cp1' ? cp : null) };
  const ownedRepo = { grant: async (_u: string, id: string) => { if (owned.has(id)) return false; owned.add(id); granted.push(id); return true; } };
  const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async (_i: string, a: number) => { refund += a; } };
  return {
    uc: new RedeemCodeUseCase(codes as never, pills as never, congphap as never, ownedRepo as never, chars as never),
    get refund() { return refund; },
    get granted() { return granted; },
  };
}

describe('RedeemCodeUseCase công pháp', () => {
  it('cấp công pháp mới', async () => {
    const b = build([{ congPhapId: 'cp1', quantity: 1 }]);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.granted).toEqual(['cp1']);
    expect(r.rewards[0].kind).toBe('congphap');
  });
  it('công pháp trùng -> hoàn Linh Thạch = duplicateRefund', async () => {
    const b = build([{ congPhapId: 'cp1', quantity: 1 }], ['cp1']);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.refund).toBe(250);
    expect(r.rewards[0].kind).toBe('linhThach');
    expect(r.rewards[0].quantity).toBe(250);
  });
  it('cấp Linh Thạch trực tiếp', async () => {
    const b = build([{ linhThach: 1000, quantity: 1 }]);
    const r = await b.uc.execute({ userId: 'u', code: 'X' });
    expect(b.refund).toBe(1000);
    expect(r.rewards[0].kind).toBe('linhThach');
  });
});
