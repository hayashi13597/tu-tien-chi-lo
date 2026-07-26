import { describe, it, expect } from 'vitest';
import { levelUpCost, duplicateRefund, materialUpgradeCost } from './congphap.calc';
import { CongPhapRecord } from './congphap';

const def: CongPhapRecord = {
  id: 'x', name: 'X', glyph: 'x', rarity: 1, category: 'passive', desc: 'd',
  active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
  effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }],
  powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
  upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null,
};

describe('levelUpCost', () => {
  it('level 1->2 = baseCost', () => { expect(levelUpCost(def, 1)).toBe(100); });
  it('lũy tiến theo costGrowth^(level-1), làm tròn', () => {
    expect(levelUpCost(def, 2)).toBe(150);      // 100 * 1.5
    expect(levelUpCost(def, 3)).toBe(225);      // 100 * 1.5^2
  });
});

describe('duplicateRefund', () => {
  it('mặc định = baseCost', () => { expect(duplicateRefund(def)).toBe(100); });
  it('dùng dupRefundLinhThach khi có', () => {
    expect(duplicateRefund({ ...def, dupRefundLinhThach: 42 })).toBe(42);
  });
});

describe('materialUpgradeCost', () => {
  it('tính cost material theo level', () => {
    expect(materialUpgradeCost({ ...def, upgradeMaterialId: 'm', baseMaterialCost: 2, materialCostGrowth: 1.5 }, 1)).toBe(2);
    expect(materialUpgradeCost({ ...def, upgradeMaterialId: 'm', baseMaterialCost: 2, materialCostGrowth: 1.5 }, 3)).toBe(5);
  });
  it('không có material thì cost bằng 0', () => {
    expect(materialUpgradeCost(def, 1)).toBe(0);
  });
});
