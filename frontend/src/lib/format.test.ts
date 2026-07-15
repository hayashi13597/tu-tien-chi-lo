import { describe, expect, it } from "vitest";
import { formatNum, formatSeconds, formatTimeAgo } from "./format";

describe("formatNum", () => {
  it("floors values below 1000", () => {
    expect(formatNum(0)).toBe("0");
    expect(formatNum(42.9)).toBe("42");
    expect(formatNum(999)).toBe("999");
  });
  it("uses K for thousands with one decimal", () => {
    expect(formatNum(1000)).toBe("1.0K");
    expect(formatNum(15200)).toBe("15.2K");
  });
  it("uses M for millions with two decimals", () => {
    expect(formatNum(1_000_000)).toBe("1.00M");
    expect(formatNum(3_280_500)).toBe("3.28M");
  });
});

describe("formatSeconds", () => {
  it("formats m:ss with zero-padded seconds", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65)).toBe("1:05");
    expect(formatSeconds(600)).toBe("10:00");
  });
});

describe("formatTimeAgo", () => {
  it("shows seconds under a minute", () => {
    expect(formatTimeAgo(45)).toBe("45s");
  });
  it("shows minutes and seconds under an hour", () => {
    expect(formatTimeAgo(125)).toBe("2m 5s");
  });
  it("shows hours and minutes at/over an hour", () => {
    expect(formatTimeAgo(3700)).toBe("1h 1m");
  });
});
