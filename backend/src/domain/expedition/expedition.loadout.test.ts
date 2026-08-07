import { describe, expect, it } from 'vitest';
import { validateLoadout } from './expedition.loadout';
import { PillRecord } from '../pills/pill';

function combatPill(id: string, overrides: Partial<PillRecord> = {}): PillRecord {
  return {
    id, name: id, glyph: '丹', rarity: 3, tier: 2, effectKind: 'combatBuff',
    amount: null, multiplier: null, durationSec: null, bonusPct: 25,
    combatAttribute: 'congVatLy', combatTrigger: 'start',
    desc: 'd', active: true, starterQuantity: 0, ...overrides,
  };
}

describe('validateLoadout', () => {
  it('trả entries chuẩn cho 2 đan combatBuff hợp lệ', () => {
    const entries = validateLoadout([combatPill('a'), combatPill('b', { combatTrigger: 'lowHp30', bonusPct: 35 })]);
    expect(entries).toEqual([
      { pillId: 'a', combatAttribute: 'congVatLy', combatTrigger: 'start', pct: 25 },
      { pillId: 'b', combatAttribute: 'congVatLy', combatTrigger: 'lowHp30', pct: 35 },
    ]);
  });

  it('rỗng khi không chọn đan', () => {
    expect(validateLoadout([])).toEqual([]);
  });

  it.each([
    ['quá 2 slot', [combatPill('a'), combatPill('b'), combatPill('c')]],
    ['trùng id', [combatPill('a'), combatPill('a')]],
    ['đan không active', [combatPill('a', { active: false })]],
    ['sai kind (linhKhi)', [combatPill('a', { effectKind: 'linhKhi', amount: 50 })]],
    ['bonusPct không dương', [combatPill('a', { bonusPct: 0 })]],
    ['combatAttribute lạ', [combatPill('a', { combatAttribute: 'xyz' as never })]],
    ['combatTrigger lạ', [combatPill('a', { combatTrigger: 'mid' as never })]],
  ])('LOADOUT_INVALID khi %s', (_label, pills) => {
    expect(() => validateLoadout(pills)).toThrowError(/LOADOUT_INVALID/);
  });
});
