import { describe, it, expect } from 'vitest';
import { SEED_REALMS, defaultRealmConfigSet } from '../../src/domain/config/realms';

describe('realms config', () => {
  it('has 12 realms, each with exactly 5 substages', () => {
    expect(SEED_REALMS).toHaveLength(12);
    for (const realm of SEED_REALMS) {
      expect(realm.subStages).toHaveLength(5);
    }
  });

  it('names the five sub-stages in cultivation order within each realm', () => {
    for (const realm of SEED_REALMS) {
      expect(realm.subStages.map((s) => s.name)).toEqual([
        'Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Đại Thành', 'Viên Mãn',
      ]);
    }
  });

  it('exposes maxRealmMajor derived from the realm count', () => {
    const set = defaultRealmConfigSet();
    expect(set.maxRealmMajor).toBe(SEED_REALMS.length - 1);
    expect(set.maxRealmMajor).toBe(11);
  });

  it('exposes peakRealmSub derived from the sub-stage count', () => {
    const set = defaultRealmConfigSet();
    expect(set.peakRealmSub(0)).toBe(SEED_REALMS[0].subStages.length - 1);
    expect(set.peakRealmSub(0)).toBe(4);
  });

  it('names the realms in the expected cultivation order', () => {
    expect(SEED_REALMS.map((r) => r.name)).toEqual([
      'Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần',
      'Phá Hư', 'Đại Thừa', 'Độ Kiếp', 'Chân Tiên', 'Kim Tiên', 'Thái Ất',
    ]);
  });

  it('has non-increasing pityIncrement as realmMajor increases', () => {
    for (let i = 1; i < SEED_REALMS.length; i++) {
      const prevPity = SEED_REALMS[i - 1].subStages[0].pityIncrement;
      const currPity = SEED_REALMS[i].subStages[0].pityIncrement;
      expect(currPity).toBeLessThanOrEqual(prevPity);
    }
  });

  it('has strictly increasing linhKhiRequired within each realm', () => {
    for (const realm of SEED_REALMS) {
      for (let i = 1; i < realm.subStages.length; i++) {
        expect(realm.subStages[i].linhKhiRequired).toBeGreaterThan(realm.subStages[i - 1].linhKhiRequired);
      }
    }
  });
});
