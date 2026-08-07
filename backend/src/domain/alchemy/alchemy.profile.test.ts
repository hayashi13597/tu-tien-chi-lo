import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  DAN_KHI_TABLE,
  FURNACE_UPGRADES,
  MAX_RANK,
  RANK_UP_COSTS,
  RANK_REALM_GATES,
  RANK_DAN_HOA_TUY_COSTS,
  AlchemyProfileRecord,
  danKhiForJob,
  furnaceSpeedPct,
  furnaceSuccessPct,
  rankSpeedPct,
  rankSuccessPct,
  rollJobOutcome,
  rankUpCheck,
  furnaceUpgradeCheck,
} from './alchemy.profile';

const profile = (overrides: Partial<AlchemyProfileRecord> = {}): AlchemyProfileRecord => ({
  id: 'p1', userId: 'u', characterId: 'c', rank: 1, danKhi: 0, furnaceLevel: 1, ...overrides,
});

const roll = (value: number) => ({ next: () => value });

// Bắt DomainError và trả code — code được Task 6 pin vào errorHandler → HTTP status,
// nên domain test phải assert chính xác code, không chỉ message.
const errorCode = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as DomainError).code;
  }
  throw new Error('expected DomainError, but nothing was thrown');
};

describe('alchemy profile domain', () => {
  it('rank/furnace bonus theo cấp', () => {
    expect(rankSuccessPct(1)).toBe(0);
    expect(rankSuccessPct(6)).toBe(15);
    expect(rankSpeedPct(3)).toBe(4);
    expect(furnaceSuccessPct(5)).toBe(16);
    expect(furnaceSpeedPct(1)).toBe(0);
  });

  it('danKhi theo tier và kết quả', () => {
    expect(DAN_KHI_TABLE).toEqual({
      1: { success: 2, fail: 1 },
      2: { success: 5, fail: 2 },
      3: { success: 10, fail: 4 },
    });
    expect(danKhiForJob({ tier: 1, successCount: 2, failCount: 1 })).toBe(5);
    expect(danKhiForJob({ tier: 2, successCount: 1, failCount: 3 })).toBe(11);
  });

  it('roll per đơn vị: thành công + xuất sắc x2 output', () => {
    const outcome = rollJobOutcome({ quantity: 3, successPct: 60, random: roll(0) });
    expect(outcome).toEqual({ successCount: 3, failCount: 0, critCount: 3, grantQuantity: 6 });
    const fail = rollJobOutcome({ quantity: 2, successPct: 60, random: roll(0.99) });
    expect(fail).toEqual({ successCount: 0, failCount: 2, critCount: 0, grantQuantity: 0 });
  });

  it('roll gián tiếp: random 0.5 thành công nhưng không xuất sắc', () => {
    const outcome = rollJobOutcome({ quantity: 2, successPct: 60, random: roll(0.5) });
    expect(outcome).toEqual({ successCount: 2, failCount: 0, critCount: 0, grantQuantity: 2 });
  });

  it('rankUpCheck kiểm Đan Khí, cap phase 1 và gate cảnh giới', () => {
    expect(MAX_RANK).toBe(9);
    expect(RANK_UP_COSTS).toEqual({ 2: 100, 3: 300, 4: 700, 5: 1300, 6: 2100, 7: 3100, 8: 4300, 9: 5700 });
    expect(RANK_REALM_GATES).toEqual({ 4: 3, 7: 5, 8: 5, 9: 5 });
    expect(RANK_DAN_HOA_TUY_COSTS).toEqual({ 7: 1, 8: 1, 9: 1 });
    expect(rankUpCheck(profile({ danKhi: 100, rank: 1 }), 2)).toBeNull();
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 99, rank: 1 }), 2))).toBe('INSUFFICIENT_DAN_KHI');
    expect(() => rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 2)).toThrow(/realmMajor 3/);
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 2))).toBe('ALCHEMY_REALM_GATE');
    expect(rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 3)).toBeNull();
    // Cap mới 9: rank 6→7 với realm thấp ném gate (không còn LOCKED); > 9 mới LOCKED.
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 9_999, rank: 6 }), 7, 0))).toBe('ALCHEMY_REALM_GATE');
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 9_999, rank: 9 }), 10, 9, 9))).toBe('ALCHEMY_RANK_LOCKED');
    expect(errorCode(() => rankUpCheck(profile({ rank: 2 }), 4, 0))).toBe('ALCHEMY_RANK_INVALID');
  });

  it('furnaceUpgradeCheck kiểm Đan Khí và thứ tự cấp', () => {
    expect(FURNACE_UPGRADES).toEqual({
      2: { danKhi: 50, linhThach: 200 },
      3: { danKhi: 150, linhThach: 600 },
      4: { danKhi: 350, linhThach: 1400 },
      5: { danKhi: 700, linhThach: 3000 },
    });
    expect(furnaceUpgradeCheck(profile({ danKhi: 50 }), 2)).toBeNull();
    expect(errorCode(() => furnaceUpgradeCheck(profile({ danKhi: 49 }), 2))).toBe('INSUFFICIENT_DAN_KHI');
    expect(errorCode(() => furnaceUpgradeCheck(profile({ furnaceLevel: 2, danKhi: 300 }), 4))).toBe('ALCHEMY_FURNACE_INVALID');
  });

  it('furnaceUpgradeCheck phân biệt lò đã max (409) với sai thứ tự (400)', () => {
    // Lò 5 nâng tiếp = gameplay denial giống rank max → ALCHEMY_FURNACE_MAX (errorHandler map 409).
    expect(() => furnaceUpgradeCheck(profile({ furnaceLevel: 5, danKhi: 9_999 }), 6)).toThrow(/tối đa 5/);
    expect(errorCode(() => furnaceUpgradeCheck(profile({ furnaceLevel: 5, danKhi: 9_999 }), 6))).toBe('ALCHEMY_FURNACE_MAX');
    // Nhảy cấp 2→4 vẫn là request sai → ALCHEMY_FURNACE_INVALID.
    expect(errorCode(() => furnaceUpgradeCheck(profile({ furnaceLevel: 2, danKhi: 300 }), 4))).toBe('ALCHEMY_FURNACE_INVALID');
  });
});

describe('rankUpCheck rank 7-9 (Thiên Giai)', () => {
  const base = { rank: 6, danKhi: 10_000 };
  it('rank 7 hợp lệ: đủ realm 5 + ĐK 3100 + Tủy 1', () => {
    expect(() => rankUpCheck(base, 7, 5, 1)).not.toThrow();
  });
  it('rank 9 hợp lệ ở realm 5 (cùng gate Hóa Thần)', () => {
    expect(() => rankUpCheck({ rank: 8, danKhi: 9999 }, 9, 5, 1)).not.toThrow();
  });
  it('rank 10 → ALCHEMY_RANK_LOCKED (cap mới 9)', () => {
    try {
      rankUpCheck({ rank: 9, danKhi: 99999 }, 10, 9, 9);
      expect.unreachable();
    } catch (e) {
      expect((e as DomainError).code).toBe('ALCHEMY_RANK_LOCKED');
    }
  });
  it('rank 7 realm 4 → ALCHEMY_REALM_GATE', () => {
    expect(() => rankUpCheck(base, 7, 4, 1)).toThrowError(/realmMajor 5/);
  });
  it('thiếu Đan Khí → INSUFFICIENT_DAN_KHI (message mang cost 3100)', () => {
    expect(() => rankUpCheck({ rank: 6, danKhi: 100 }, 7, 5, 1)).toThrowError(/3100/);
  });
  it('đủ ĐK + realm nhưng 0 Tủy → ALCHEMY_MISSING_DAN_HOA_TUY', () => {
    try {
      rankUpCheck(base, 7, 5, 0);
      expect.unreachable();
    } catch (e) {
      expect((e as DomainError).code).toBe('ALCHEMY_MISSING_DAN_HOA_TUY');
    }
  });
  it('rank 1-6 không cần Tủy (hành vi cũ)', () => {
    expect(() => rankUpCheck({ rank: 5, danKhi: 2100 }, 6, 0)).not.toThrow();
  });
});
