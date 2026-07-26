import { describe, expect, it } from "vitest";
import { CURVE_MIN_HEIGHT, curveHeights } from "./realm-curve";

describe("curveHeights", () => {
  it("trả về dãy rỗng cho đầu vào rỗng", () => {
    expect(curveHeights([])).toEqual([]);
  });

  it("một giá trị thì cột đầy", () => {
    expect(curveHeights([100])).toEqual([1]);
  });

  it("mọi giá trị bằng nhau thì mọi cột đều đầy (không chia cho 0)", () => {
    expect(curveHeights([500, 500, 500])).toEqual([1, 1, 1]);
  });

  it("dãy tăng theo cấp số nhân cho các bước đều nhau trên thang log", () => {
    const h = curveHeights([100, 200, 400, 800]);
    expect(h[0]).toBeCloseTo(CURVE_MIN_HEIGHT, 6);
    expect(h[3]).toBeCloseTo(1, 6);
    // Cấp số nhân → khoảng cách giữa các cột liên tiếp bằng nhau.
    expect(h[1] - h[0]).toBeCloseTo(h[2] - h[1], 6);
    expect(h[2] - h[1]).toBeCloseTo(h[3] - h[2], 6);
  });

  it("giá trị NaN hoặc không dương thành cột 0 mà không làm hỏng dãy", () => {
    const h = curveHeights([100, Number.NaN, 400]);
    expect(h[1]).toBe(0);
    expect(h[0]).toBeCloseTo(CURVE_MIN_HEIGHT, 6);
    expect(h[2]).toBeCloseTo(1, 6);
  });

  it("giá trị 0 thành cột 0, phần còn lại vẫn chuẩn hóa được", () => {
    expect(curveHeights([0, 100])).toEqual([0, 1]);
  });

  it("không có giá trị nào dùng được thì mọi cột bằng 0", () => {
    expect(curveHeights([Number.NaN, 0, -5])).toEqual([0, 0, 0]);
  });
});
