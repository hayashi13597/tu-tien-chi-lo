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
});
