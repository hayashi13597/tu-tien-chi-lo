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
