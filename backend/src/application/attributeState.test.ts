import { describe, it, expect } from 'vitest';
import { buildAttributeState } from './attributeState';
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
