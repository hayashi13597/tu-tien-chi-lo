import { describe, it, expect } from 'vitest';
import { validatePillDefinition } from '../../src/domain/pills/pill.validate';
import { PillRecord } from '../../src/domain/pills/pill';
import { DomainError } from '../../src/domain/errors';

function pill(over: Partial<PillRecord> = {}): PillRecord {
  return {
    id: 'test-dan', name: 'Test Đan', glyph: '试', rarity: 0, tier: 1, effectKind: 'linhKhi',
    amount: 50, multiplier: null, durationSec: null, bonusPct: null,
    // Phase 3 — mặc định không phải đan combat.
    combatAttribute: null, combatTrigger: null,
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
    expect(() => validatePillDefinition(pill({
      effectKind: 'combatBuff', amount: null, bonusPct: 25,
      combatAttribute: 'congVatLy', combatTrigger: 'start',
    }))).not.toThrow();
    expect(() => validatePillDefinition(pill({
      effectKind: 'combatBuff', amount: null, bonusPct: 35,
      combatAttribute: 'khiHuyet', combatTrigger: 'lowHp30',
    }))).not.toThrow();
  });

  it('rejects combatBuff incoherent payloads', () => {
    const base = { effectKind: 'combatBuff' as const, amount: null, bonusPct: 25, combatAttribute: 'congVatLy' as const, combatTrigger: 'start' as const };
    expectInvalid(pill({ ...base, bonusPct: null }));
    expectInvalid(pill({ ...base, bonusPct: 0 }));
    expectInvalid(pill({ ...base, bonusPct: -5 }));
    expectInvalid(pill({ ...base, combatAttribute: null }));
    expectInvalid(pill({ ...base, combatAttribute: 'mana' as never }));
    expectInvalid(pill({ ...base, combatTrigger: null }));
    expectInvalid(pill({ ...base, combatTrigger: 'mid' as never }));
    expectInvalid(pill({ ...base, amount: 10 }));
    expectInvalid(pill({ ...base, multiplier: 2 }));
    expectInvalid(pill({ ...base, durationSec: 60 }));
  });

  it('rejects orphan combat fields on non-combat kinds', () => {
    expectInvalid(pill({ combatAttribute: 'congVatLy' }));
    expectInvalid(pill({ combatTrigger: 'start' }));
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

  it('tier chỉ chấp nhận 1..3: tier 0/4/non-integer reject, tier 2 hợp lệ', () => {
    expectInvalid(pill({ tier: 0 }));
    expectInvalid(pill({ tier: 4 }));
    expectInvalid(pill({ tier: 1.5 }));
    expect(() => validatePillDefinition(pill({ tier: 2 }))).not.toThrow();
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
