import { describe, it, expect } from 'vitest';
import { validateRedeemCodeDefinition, normalizeCode } from '../../src/domain/redeem/redeemCode.validate';
import { DomainError } from '../../src/domain/errors';

const base = { code: 'ABC', maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 2 }] };

describe('normalizeCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCode('  abc2026 ')).toBe('ABC2026');
  });
});

describe('validateRedeemCodeDefinition', () => {
  it('accepts a valid definition', () => {
    expect(() => validateRedeemCodeDefinition(base)).not.toThrow();
  });
  it('rejects an empty code', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, code: '   ' })).toThrow(DomainError);
  });
  it('rejects maxRedemptions < 1', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, maxRedemptions: 0 })).toThrow(DomainError);
  });
  it('rejects a non-integer maxRedemptions', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, maxRedemptions: 1.5 })).toThrow(DomainError);
  });
  it('rejects empty rewards', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [] })).toThrow(DomainError);
  });
  it('rejects a reward quantity < 1', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'p1', quantity: 0 }] })).toThrow(DomainError);
  });
  it('rejects a duplicate pillId', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'p1', quantity: 1 }, { pillId: 'p1', quantity: 2 }] })).toThrow(DomainError);
  });
  it('accepts congphap and linhThach rewards', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ congPhapId: 'cp1', quantity: 1 }, { linhThach: 500, quantity: 1 }] })).not.toThrow();
  });
  it('rejects a reward with no kind set', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ quantity: 1 }] })).toThrow(DomainError);
  });
  it('rejects a reward mixing two kinds', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'p1', congPhapId: 'cp1', quantity: 1 }] })).toThrow(DomainError);
  });
  it('rejects a linhThach reward < 1', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ linhThach: 0, quantity: 1 }] })).toThrow(DomainError);
  });
  it('allows the same id across different reward kinds', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'x', quantity: 1 }, { congPhapId: 'x', quantity: 1 }] })).not.toThrow();
  });
});

describe('reward loại material (Phase 2)', () => {
  it('chấp nhận reward materialId', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ materialId: 'bi-tich-x', quantity: 1 }] })).not.toThrow();
  });
  it('chặn materialId đi kèm loại khác (đúng một loại)', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ materialId: 'bi-tich-x', pillId: 'p1', quantity: 1 }] })).toThrow(DomainError);
  });
  it('chặn materialId trùng lặp', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ materialId: 'bi-tich-x', quantity: 1 }, { materialId: 'bi-tich-x', quantity: 2 }] })).toThrow(DomainError);
  });
});
