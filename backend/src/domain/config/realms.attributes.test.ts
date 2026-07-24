import { describe, it, expect } from 'vitest';
import { defaultRealmConfigSet, deriveBaseAttributes, flattenRealms, realmConfigSetFromRows, SEED_REALMS } from './realms';

describe('deriveBaseAttributes', () => {
  it('tỉ lệ theo cultivationRate, làm tròn', () => {
    const a = deriveBaseAttributes(1);
    expect(a.khiHuyet).toBe(40);
    expect(a.congVatLy).toBe(6);
    expect(a.tocDo).toBe(2);
  });
});

describe('RealmConfigSet.baseAttributes', () => {
  it('trả 6 thuộc tính cho stage hợp lệ', () => {
    const cfg = defaultRealmConfigSet();
    const a = cfg.baseAttributes(0, 0);
    expect(a.khiHuyet).toBeGreaterThan(0);
    expect(Object.keys(a).sort()).toEqual(['chanNguyen','congPhep','congVatLy','khiHuyet','phongThu','tocDo']);
  });
});

describe('flatten/fromRows round-trip mang base', () => {
  it('giữ nguyên base khi phẳng rồi dựng lại', () => {
    const rows = flattenRealms(SEED_REALMS);
    expect(rows[0].baseKhiHuyet).toBeGreaterThan(0);
    const cfg = realmConfigSetFromRows(rows);
    expect(cfg.baseAttributes(0, 0).khiHuyet).toBe(rows[0].baseKhiHuyet);
  });
});
