import { describe, it, expect } from 'vitest';
import { buildAttributeState, buildSystemBuffs } from './attributeState';
import { defaultRealmConfigSet } from '../domain/config/realms';
import { OwnedCongPhapEntry } from '../domain/congphap/congphap';

const cfg = defaultRealmConfigSet();

const passiveOwned: OwnedCongPhapEntry = {
  def: { id: 'p', name: 'P', glyph: 'p', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 100, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null },
  level: 2, equippedSlot: null,
};
const activeOwned: OwnedCongPhapEntry = {
  def: { id: 'a', name: 'A', glyph: 'a', rarity: 3, category: 'active', desc: 'd', active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6, effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null },
  level: 5, equippedSlot: 0,
};

describe('buildAttributeState', () => {
  it('chỉ passive active cộng thuộc tính; active bị bỏ qua', () => {
    const base = cfg.baseAttributes(0, 0);
    const s = buildAttributeState(cfg, 0, 0, [passiveOwned, activeOwned]);
    expect(s.attributes.final.khiHuyet).toBe(base.khiHuyet + 200); // 100/level * 2
    expect(s.attributes.base.khiHuyet).toBe(base.khiHuyet);
    expect(s.battlePower).toBeGreaterThan(0);
  });
  it('bỏ qua passive def.active=false', () => {
    const base = cfg.baseAttributes(0, 0);
    const disabled = { ...passiveOwned, def: { ...passiveOwned.def, active: false } };
    const s = buildAttributeState(cfg, 0, 0, [disabled]);
    expect(s.attributes.final.khiHuyet).toBe(base.khiHuyet);
  });
});

describe('buildSystemBuffs (Phase 2)', () => {
  const tuLuyen = {
    def: { id: 'tl', name: 'TL', glyph: 't', rarity: 3, category: 'passive' as const, desc: 'd', active: true, maxLevel: 10, baseCost: 300, costGrowth: 1.6, effects: [{ attribute: 'linhKhiRate' as const, flatPerLevel: 0, pctPerLevel: 2 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 2, branch: 'tuLuyen' as const, minRealmMajor: 3, biTichMaterialId: 'bi-tich-tl' },
    level: 10, equippedSlot: null,
  };
  const inactiveBuff = {
    def: { ...tuLuyen.def, id: 'off', active: false },
    level: 10, equippedSlot: null,
  };

  it('nhân multiplier = 1 + pct/100; bỏ qua môn inactive', () => {
    const buffs = buildSystemBuffs([tuLuyen, inactiveBuff]);
    expect(buffs.linhKhiRatePct).toBe(20);
    expect(buffs.linhKhiRateMultiplier).toBeCloseTo(1.2);
    expect(buffs.danDaoSuccessPct).toBe(0);
  });

  it('rỗng → multiplier 1, pct 0', () => {
    expect(buildSystemBuffs([])).toEqual({ linhKhiRatePct: 0, danDaoSuccessPct: 0, linhKhiRateMultiplier: 1 });
  });
});
