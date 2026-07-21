import { describe, it, expect } from 'vitest';
import { ListRedeemCodesUseCase } from '../../src/application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from '../../src/application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from '../../src/application/UpdateRedeemCodeUseCase';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

function repo() { return new InMemoryRedeemCodeRepository(); }
const baseInput = { id: 'c1', code: 'abc', active: true, maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 2 }] };

describe('ListRedeemCodesUseCase', () => {
  it('returns all codes including inactive', async () => {
    const r = repo();
    r.seedCode({ ...baseInput, code: 'ABC', redeemedCount: 0 });
    r.seedCode({ id: 'c2', code: 'XYZ', active: false, maxRedemptions: 1, redeemedCount: 1, expiresAt: null, rewards: [] });
    const list = await new ListRedeemCodesUseCase(r).execute();
    expect(list).toHaveLength(2);
  });
});

describe('CreateRedeemCodeUseCase', () => {
  it('normalizes the code and creates', async () => {
    const r = repo();
    const created = await new CreateRedeemCodeUseCase(r).execute(baseInput);
    expect(created.code).toBe('ABC'); // normalized
    expect((await r.findByCode('ABC'))?.id).toBe('c1');
  });

  it('throws REDEEM_CODE_TAKEN for a duplicate (case-insensitive)', async () => {
    const r = repo();
    await new CreateRedeemCodeUseCase(r).execute(baseInput);
    await expect(new CreateRedeemCodeUseCase(r).execute({ ...baseInput, id: 'c2' })).rejects.toMatchObject({ code: 'REDEEM_CODE_TAKEN' });
  });

  it('throws INVALID_REDEEM_CODE for invalid input', async () => {
    const r = repo();
    await expect(new CreateRedeemCodeUseCase(r).execute({ ...baseInput, maxRedemptions: 0 })).rejects.toMatchObject({ code: 'INVALID_REDEEM_CODE' });
  });
});

describe('UpdateRedeemCodeUseCase', () => {
  it('updates an existing code', async () => {
    const r = repo();
    const created = await new CreateRedeemCodeUseCase(r).execute(baseInput);
    const updated = await new UpdateRedeemCodeUseCase(r).execute({ ...created, maxRedemptions: 10 });
    expect(updated.maxRedemptions).toBe(10);
  });

  it('throws REDEEM_CODE_NOT_FOUND for an unknown id', async () => {
    const r = repo();
    // Valid rewards so validation passes and the use case reaches the update
    // call — the not-found result comes from update() returning false, not validation.
    const ghost: RedeemCodeRecord = { id: 'ghost', code: 'GHOST', active: true, maxRedemptions: 1, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 1 }] };
    await expect(new UpdateRedeemCodeUseCase(r).execute(ghost)).rejects.toMatchObject({ code: 'REDEEM_CODE_NOT_FOUND' });
  });
});
