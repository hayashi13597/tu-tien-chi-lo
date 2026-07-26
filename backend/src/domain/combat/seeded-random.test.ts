import { describe, expect, it } from 'vitest';
import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  it('cùng seed tạo cùng sequence trong [0, 1)', () => {
    const first = new SeededRandom(123);
    const second = new SeededRandom(123);
    const a = Array.from({ length: 5 }, () => first.next());
    const b = Array.from({ length: 5 }, () => second.next());
    expect(a).toEqual(b);
    expect(a.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
