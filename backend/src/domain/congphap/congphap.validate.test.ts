import { describe, it, expect } from 'vitest';
import { validateCongPhapDefinition } from './congphap.validate';
import { CongPhapRecord } from './congphap';
import { DomainError } from '../errors';

const passive: CongPhapRecord = {
  id: 'thiet-cot-quyet', name: 'Thiết Cốt', glyph: '铁', rarity: 1, category: 'passive',
  desc: 'd', active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
  effects: [{ attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 0 }],
  powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
  upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null,
  tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null,
};
const active: CongPhapRecord = {
  id: 'liet-hoa', name: 'Liệt Hỏa', glyph: '火', rarity: 3, category: 'active',
  desc: 'd', active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6,
  effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null,
  upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null,
  tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null,
};

function expectFail(def: CongPhapRecord) {
  expect(() => validateCongPhapDefinition(def)).toThrow(DomainError);
  try { validateCongPhapDefinition(def); } catch (e) {
    expect((e as DomainError).code).toBe('INVALID_CONGPHAP_CONFIG');
  }
}

describe('validateCongPhapDefinition', () => {
  it('chấp nhận passive/active hợp lệ', () => {
    expect(() => validateCongPhapDefinition(passive)).not.toThrow();
    expect(() => validateCongPhapDefinition(active)).not.toThrow();
  });
  it('id sai slug', () => expectFail({ ...passive, id: 'Bad_Id' }));
  it('maxLevel < 1', () => expectFail({ ...passive, maxLevel: 0 }));
  it('costGrowth < 1', () => expectFail({ ...passive, costGrowth: 0.9 }));
  it('baseCost < 0', () => expectFail({ ...passive, baseCost: -1 }));
  it('passive không có effect', () => expectFail({ ...passive, effects: [] }));
  it('passive effect attribute lạ', () => expectFail({ ...passive, effects: [{ attribute: 'xxx' as never, flatPerLevel: 1, pctPerLevel: 0 }] }));
  it('passive lại có powerPerLevel', () => expectFail({ ...passive, powerPerLevel: 5 }));
  it('active không powerPerLevel > 0', () => expectFail({ ...active, powerPerLevel: 0 }));
  it('active lại có effects', () => expectFail({ ...active, effects: passive.effects }));

  // Phase 2 rules
  it('chấp nhận key đặc biệt (flat=0, pct>0)', () => {
    expect(() => validateCongPhapDefinition({
      ...passive,
      effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 1 }],
    })).not.toThrow();
    expect(() => validateCongPhapDefinition({
      ...passive,
      effects: [{ attribute: 'linhKhiRate', flatPerLevel: 0, pctPerLevel: 2 }],
    })).not.toThrow();
  });
  it('key đặc biệt phải flat=0 và pct>0', () => {
    expectFail({ ...passive, effects: [{ attribute: 'linhKhiRate', flatPerLevel: 1, pctPerLevel: 2 }] });
    expectFail({ ...passive, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 0 }] });
    expectFail({ ...passive, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: -1 }] });
  });
  it('tier >= 2 bắt buộc branch và biTich', () => {
    expectFail({ ...passive, tier: 2, branch: null, biTichMaterialId: 'bi-tich-x' });
    expectFail({ ...passive, tier: 2, biTichMaterialId: null });
    expect(() => validateCongPhapDefinition({ ...passive, tier: 2, branch: 'danDao', biTichMaterialId: 'bi-tich-x', minRealmMajor: 3 })).not.toThrow();
  });
  it('tier ngoài 1..3 bị chặn', () => {
    expectFail({ ...passive, tier: 0 });
    expectFail({ ...passive, tier: 4 });
  });
  it('branch lạ bị chặn; branch null hợp lệ với tier 1', () => {
    expectFail({ ...passive, branch: 'xxx' as never });
    expect(() => validateCongPhapDefinition({ ...passive, branch: null })).not.toThrow();
  });
  it('minRealmMajor âm bị chặn', () => expectFail({ ...passive, minRealmMajor: -1 }));
});
