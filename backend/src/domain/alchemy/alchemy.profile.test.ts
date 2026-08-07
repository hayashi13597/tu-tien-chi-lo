import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  DAN_KHI_TABLE,
  FURNACE_UPGRADES,
  MAX_RANK,
  RANK_UP_COSTS,
  RANK_REALM_GATES,
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
    expect(MAX_RANK).toBe(6);
    expect(RANK_UP_COSTS).toEqual({ 2: 100, 3: 300, 4: 700, 5: 1300, 6: 2100 });
    expect(RANK_REALM_GATES).toEqual({ 4: 3, 7: 6 });
    expect(rankUpCheck(profile({ danKhi: 100, rank: 1 }), 2)).toBeNull();
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 99, rank: 1 }), 2))).toBe('INSUFFICIENT_DAN_KHI');
    expect(() => rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 2)).toThrow(/Kết Đan/);
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 2))).toBe('ALCHEMY_REALM_GATE');
    expect(rankUpCheck(profile({ danKhi: 700, rank: 3 }), 4, 3)).toBeNull();
    expect(errorCode(() => rankUpCheck(profile({ danKhi: 9_999, rank: 6 }), 7, 6))).toBe('ALCHEMY_RANK_LOCKED');
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
});
