import { describe, expect, it } from "vitest";
import {
  effectiveCultivationRate,
  interpolateLinhKhi,
} from "./cultivation-display";

const T0 = Date.parse("2026-07-18T10:00:00.000Z");
const sec = (s: number) => T0 + s * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("effectiveCultivationRate", () => {
  it("returns the base rate when no buff is present", () => {
    expect(
      effectiveCultivationRate(
        {
          cultivationRate: 2,
          cultivationBuffMultiplier: null,
          cultivationBuffUntil: null,
        },
        T0,
      ),
    ).toBe(2);
  });

  it("multiplies the base rate while the buff is active", () => {
    expect(
      effectiveCultivationRate(
        {
          cultivationRate: 2,
          cultivationBuffMultiplier: 1.5,
          cultivationBuffUntil: iso(sec(60)),
        },
        T0,
      ),
    ).toBe(3);
  });

  it("returns the base rate once the buff has expired", () => {
    expect(
      effectiveCultivationRate(
        {
          cultivationRate: 2,
          cultivationBuffMultiplier: 1.5,
          cultivationBuffUntil: iso(sec(60)),
        },
        sec(61),
      ),
    ).toBe(2);
  });
});

describe("interpolateLinhKhi", () => {
  const base = {
    linhKhi: 100,
    cultivationRate: 2,
  };

  it("accrues at the base rate with no buff", () => {
    expect(
      interpolateLinhKhi(
        {
          ...base,
          cultivationBuffMultiplier: null,
          cultivationBuffUntil: null,
        },
        T0,
        sec(10),
      ),
    ).toBe(100 + 10 * 2);
  });

  it("accrues at the buffed rate while the buff covers the whole window", () => {
    expect(
      interpolateLinhKhi(
        {
          ...base,
          cultivationBuffMultiplier: 1.5,
          cultivationBuffUntil: iso(sec(60)),
        },
        T0,
        sec(10),
      ),
    ).toBe(100 + 10 * 2 * 1.5);
  });

  it("splits piecewise when the buff expires mid-window", () => {
    // 6s buffed at 3/s + 4s plain at 2/s.
    expect(
      interpolateLinhKhi(
        {
          ...base,
          cultivationBuffMultiplier: 1.5,
          cultivationBuffUntil: iso(sec(6)),
        },
        T0,
        sec(10),
      ),
    ).toBe(100 + 6 * 3 + 4 * 2);
  });

  it("ignores a buff that expired before the window began", () => {
    expect(
      interpolateLinhKhi(
        {
          ...base,
          cultivationBuffMultiplier: 1.5,
          cultivationBuffUntil: iso(sec(-5)),
        },
        T0,
        sec(10),
      ),
    ).toBe(100 + 10 * 2);
  });

  it("never rolls backward when now precedes the last fetch", () => {
    expect(
      interpolateLinhKhi(
        {
          ...base,
          cultivationBuffMultiplier: null,
          cultivationBuffUntil: null,
        },
        T0,
        sec(-3),
      ),
    ).toBe(100);
  });
});
