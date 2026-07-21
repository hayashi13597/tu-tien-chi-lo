import { describe, it, expect } from 'vitest';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

function code(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'c1', code: 'ABC', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 3 }], ...over };
}

describe('InMemoryRedeemCodeRepository', () => {
  it('finds by code and lists all', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code());
    expect((await repo.findByCode('ABC'))?.id).toBe('c1');
    expect(await repo.listAll()).toHaveLength(1);
  });

  it('reserves once per user, rejecting a second reservation', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code());
    expect(await repo.tryReserveRedemption('c1', 'u1', 2)).toBe('ok');
    expect(await repo.tryReserveRedemption('c1', 'u1', 2)).toBe('already_redeemed');
  });

  it('returns exhausted once the cap is reached', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code({ maxRedemptions: 1 }));
    expect(await repo.tryReserveRedemption('c1', 'u1', 1)).toBe('ok');
    expect(await repo.tryReserveRedemption('c1', 'u2', 1)).toBe('exhausted');
  });

  it('grants rewards additively into inventory', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    await repo.grantRewards('u1', [{ pillId: 'p1', quantity: 3 }, { pillId: 'p2', quantity: 1 }]);
    await repo.grantRewards('u1', [{ pillId: 'p1', quantity: 2 }]);
    expect(repo.getInventory('u1').get('p1')).toBe(5);
    expect(repo.getInventory('u1').get('p2')).toBe(1);
  });
});
