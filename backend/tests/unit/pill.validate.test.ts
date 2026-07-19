import { describe, it, expect } from 'vitest';
import { validatePillDefinition } from '../../src/domain/pills/pill.validate';
import { PillRecord } from '../../src/domain/pills/pill';
import { DomainError } from '../../src/domain/errors';

function pill(over: Partial<PillRecord> = {}): PillRecord {
  return {
    id: 'test-dan', name: 'Test Đan', glyph: '试', rarity: 0, effectKind: 'linhKhi',
    amount: 50, multiplier: null, durationSec: null, bonusPct: null,
    desc: 'mô tả', active: true, starterQuantity: 0, ...over,
  };
}

function expectInvalid(p: PillRecord) {
  try {
    validatePillDefinition(p);
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe('INVALID_PILL_CONFIG');
  }
}

describe('validatePillDefinition', () => {
  it('accepts a valid pill of each effect kind', () => {
    expect(() => validatePillDefinition(pill())).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'cultivationBuff', amount: null, multiplier: 1.5, durationSec: 60 }))).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'breakthroughBoost', amount: null, bonusPct: 15 }))).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'clearPunishment', amount: null }))).not.toThrow();
  });

  it('rejects empty name / glyph / desc', () => {
    expectInvalid(pill({ name: '  ' }));
    expectInvalid(pill({ glyph: '' }));
    expectInvalid(pill({ desc: '' }));
  });

  it('rejects out-of-range or non-integer rarity', () => {
    expectInvalid(pill({ rarity: -1 }));
    expectInvalid(pill({ rarity: 5 }));
    expectInvalid(pill({ rarity: 1.5 }));
  });

  it('rejects negative or non-integer starterQuantity', () => {
    expectInvalid(pill({ starterQuantity: -1 }));
    expectInvalid(pill({ starterQuantity: 0.5 }));
  });

  it('linhKhi requires amount > 0', () => {
    expectInvalid(pill({ amount: null }));
    expectInvalid(pill({ amount: 0 }));
    expectInvalid(pill({ amount: -5 }));
  });

  it('cultivationBuff requires multiplier > 1 and durationSec > 0 (integer)', () => {
    const base = { effectKind: 'cultivationBuff' as const, amount: null };
    expectInvalid(pill({ ...base, multiplier: null, durationSec: 60 }));
    expectInvalid(pill({ ...base, multiplier: 1, durationSec: 60 }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: null }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: 0 }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: 1.5 }));
  });

  it('breakthroughBoost requires bonusPct > 0', () => {
    const base = { effectKind: 'breakthroughBoost' as const, amount: null };
    expectInvalid(pill({ ...base, bonusPct: null }));
    expectInvalid(pill({ ...base, bonusPct: 0 }));
  });

  it('rejects stat fields orphaned outside their effect kind', () => {
    // linhKhi pill carrying a multiplier
    expectInvalid(pill({ multiplier: 2 }));
    // clearPunishment pill carrying any stat
    expectInvalid(pill({ effectKind: 'clearPunishment', amount: 10 }));
    expectInvalid(pill({ effectKind: 'clearPunishment', amount: null, bonusPct: 5 }));
  });
});
