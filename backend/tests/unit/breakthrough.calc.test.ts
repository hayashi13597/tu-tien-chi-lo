import { describe, it, expect } from 'vitest';
import { computeSuccessRate, rollSuccess, nextStage, isMaxStage } from '../../src/domain/breakthrough/breakthrough.calc';

describe('computeSuccessRate', () => {
  it('adds pityIncrement per failure to baseSuccessRate', () => {
    const rate = computeSuccessRate({ baseSuccessRate: 50, pityIncrement: 5, maxSuccessRate: 95, breakthroughFails: 3 });
    expect(rate).toBe(65);
  });

  it('caps the result at maxSuccessRate', () => {
    const rate = computeSuccessRate({ baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, breakthroughFails: 5 });
    expect(rate).toBe(95);
  });
});

describe('rollSuccess', () => {
  it('succeeds when the random roll lands below the success rate', () => {
    expect(rollSuccess(80, 0.5)).toBe(true);
  });

  it('fails when the random roll lands at or above the success rate', () => {
    expect(rollSuccess(30, 0.5)).toBe(false);
  });
});

describe('nextStage', () => {
  it('advances the substage within the same realm', () => {
    expect(nextStage(1, 0)).toEqual({ realmMajor: 1, realmSub: 1 });
  });

  it('rolls over to the next realm major at Đại Viên Mãn (substage 3)', () => {
    expect(nextStage(1, 3)).toEqual({ realmMajor: 2, realmSub: 0 });
  });
});

describe('isMaxStage', () => {
  it('is true only at the max realm major and substage 3', () => {
    expect(isMaxStage(11, 3, 11)).toBe(true);
  });

  it('is false at the max realm major but an earlier substage', () => {
    expect(isMaxStage(11, 2, 11)).toBe(false);
  });

  it('is false below the max realm major', () => {
    expect(isMaxStage(10, 3, 11)).toBe(false);
  });
});
