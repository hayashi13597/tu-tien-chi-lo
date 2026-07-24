import { describe, it, expect } from 'vitest';
import { validateCongPhapDefinition } from './congphap.validate';
import { CongPhapRecord } from './congphap';
import { DomainError } from '../errors';

const passive: CongPhapRecord = {
  id: 'thiet-cot-quyet', name: 'Thiết Cốt', glyph: '铁', rarity: 1, category: 'passive',
  desc: 'd', active: true, maxLevel: 10, baseCost: 100, costGrowth: 1.5,
  effects: [{ attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 0 }],
  powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null,
};
const active: CongPhapRecord = {
  id: 'liet-hoa', name: 'Liệt Hỏa', glyph: '火', rarity: 3, category: 'active',
  desc: 'd', active: true, maxLevel: 10, baseCost: 200, costGrowth: 1.6,
  effects: null, powerPerLevel: 120, chanNguyenCost: 30, dupRefundLinhThach: null,
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
});
