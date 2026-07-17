import { describe, it, expect } from 'vitest';
import { computeLinhKhi, OFFLINE_CAP_SECONDS } from '../../src/domain/cultivation/cultivation.calc';

describe('computeLinhKhi', () => {
  it('adds elapsed time times rate to stored linh khi', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-01T00:00:10.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 100, lastUpdateAt, now, cultivationRate: 2 });
    expect(result).toBe(120);
  });

  it('returns the stored value unchanged when no time has elapsed', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 50, lastUpdateAt, now: lastUpdateAt, cultivationRate: 5 });
    expect(result).toBe(50);
  });

  it('caps elapsed time at OFFLINE_CAP_SECONDS by default', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-03T00:00:00.000Z'); // 48 hours later
    const result = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt, now, cultivationRate: 1 });
    expect(result).toBe(OFFLINE_CAP_SECONDS);
  });

  it('never goes backwards if now is before lastUpdateAt', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:10.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 10, lastUpdateAt, now, cultivationRate: 3 });
    expect(result).toBe(10);
  });
});

describe('computeLinhKhi with cultivation buff', () => {
  const base = new Date('2026-01-01T00:00:00Z');

  it('is unchanged when no buff is given (backward compatible)', () => {
    const now = new Date(base.getTime() + 100_000); // 100s
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2 });
    expect(v).toBeCloseTo(200, 5); // 100s * 2
  });

  it('accrues the whole window at rate*multiplier when buff covers it', () => {
    const now = new Date(base.getTime() + 100_000);
    const until = new Date(base.getTime() + 200_000); // buff outlives the window
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 2, until } });
    expect(v).toBeCloseTo(400, 5); // 100s * 2 * 2
  });

  it('splits buffed and un-buffed segments when the buff expires mid-window', () => {
    const now = new Date(base.getTime() + 100_000);   // window 100s
    const until = new Date(base.getTime() + 40_000);  // buff ends at 40s
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 3, until } });
    // buffed: 40s * 2 * 3 = 240 ; un-buffed: 60s * 2 = 120 ; total 360
    expect(v).toBeCloseTo(360, 5);
  });

  it('ignores a buff that already expired before the window', () => {
    const now = new Date(base.getTime() + 100_000);
    const until = new Date(base.getTime() - 10_000); // expired before lastUpdateAt
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 5, until } });
    expect(v).toBeCloseTo(200, 5); // as if no buff
  });
});
