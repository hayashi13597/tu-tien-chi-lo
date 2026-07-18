import { describe, it, expect } from 'vitest';
import { REALMS, MAX_REALM_MAJOR, MAX_REALM_SUB } from '../../src/domain/config/realms';

describe('realms config', () => {
  it('has 12 realms, each with exactly 5 substages', () => {
    expect(REALMS).toHaveLength(12);
    for (const realm of REALMS) {
      expect(realm.subStages).toHaveLength(5);
    }
  });

  it('names the five sub-stages in cultivation order within each realm', () => {
    for (const realm of REALMS) {
      expect(realm.subStages.map((s) => s.name)).toEqual([
        'Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Đại Thành', 'Viên Mãn',
      ]);
    }
  });

  it('derives MAX_REALM_MAJOR from the array length', () => {
    expect(MAX_REALM_MAJOR).toBe(REALMS.length - 1);
    expect(MAX_REALM_MAJOR).toBe(11);
  });

  it('derives MAX_REALM_SUB from the sub-stage count', () => {
    expect(MAX_REALM_SUB).toBe(REALMS[0].subStages.length - 1);
    expect(MAX_REALM_SUB).toBe(4);
  });

  it('names the realms in the expected cultivation order', () => {
    expect(REALMS.map((r) => r.name)).toEqual([
      'Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần',
      'Phá Hư', 'Đại Thừa', 'Độ Kiếp', 'Chân Tiên', 'Kim Tiên', 'Thái Ất',
    ]);
  });

  it('has non-increasing pityIncrement as realmMajor increases', () => {
    for (let i = 1; i < REALMS.length; i++) {
      const prevPity = REALMS[i - 1].subStages[0].pityIncrement;
      const currPity = REALMS[i].subStages[0].pityIncrement;
      expect(currPity).toBeLessThanOrEqual(prevPity);
    }
  });

  it('has strictly increasing linhKhiRequired within each realm', () => {
    for (const realm of REALMS) {
      for (let i = 1; i < realm.subStages.length; i++) {
        expect(realm.subStages[i].linhKhiRequired).toBeGreaterThan(realm.subStages[i - 1].linhKhiRequired);
      }
    }
  });
});
