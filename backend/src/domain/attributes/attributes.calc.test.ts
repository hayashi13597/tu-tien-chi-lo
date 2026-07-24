import { describe, it, expect } from 'vitest';
import { computeAttributes, computeBattlePower } from './attributes.calc';
import { AttributeSet, BATTLE_POWER_WEIGHTS } from './attributes';

const ZERO: AttributeSet = { khiHuyet: 0, chanNguyen: 0, congVatLy: 0, congPhep: 0, phongThu: 0, tocDo: 0 };
const base: AttributeSet = { khiHuyet: 100, chanNguyen: 80, congVatLy: 20, congPhep: 20, phongThu: 10, tocDo: 5 };

describe('computeAttributes', () => {
  it('trả base nguyên vẹn khi không có passive', () => {
    const r = computeAttributes(base, []);
    expect(r.base).toEqual(base);
    expect(r.final).toEqual(base);
  });

  it('cộng phẳng trước, nhân % sau (flat*level rồi (1+pct*level/100))', () => {
    // khiHuyet: flat 50/level, pct 10/level, level 2 => (100 + 100) * (1 + 20/100) = 240
    const r = computeAttributes(base, [
      { level: 2, effects: [{ attribute: 'khiHuyet', flatPerLevel: 50, pctPerLevel: 10 }] },
    ]);
    expect(r.final.khiHuyet).toBe(240);
    expect(r.final.congVatLy).toBe(20); // không ảnh hưởng
  });

  it('gộp nhiều passive lên cùng thuộc tính', () => {
    const r = computeAttributes(base, [
      { level: 1, effects: [{ attribute: 'phongThu', flatPerLevel: 10, pctPerLevel: 0 }] },
      { level: 1, effects: [{ attribute: 'phongThu', flatPerLevel: 0, pctPerLevel: 50 }] },
    ]);
    // (10 + 10) * (1 + 50/100) = 30
    expect(r.final.phongThu).toBe(30);
  });
});

describe('computeBattlePower', () => {
  it('tổng trọng số làm tròn', () => {
    const bp = computeBattlePower(base, BATTLE_POWER_WEIGHTS);
    // 100*.1 + 80*.1 + 20*1 + 20*1 + 10*.8 + 5*1.2 = 10+8+20+20+8+6 = 72
    expect(bp).toBe(72);
  });
  it('mặc định dùng BATTLE_POWER_WEIGHTS', () => {
    expect(computeBattlePower(ZERO)).toBe(0);
  });
});
