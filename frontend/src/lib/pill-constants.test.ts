import { describe, expect, it } from "vitest";
import {
  getRarityMeta,
  RARITY_META,
  RARITY_PIPS,
  rarityPipCount,
} from "./pill-constants";
import type { PillRarity } from "./types";

describe("pill-constants rarity table", () => {
  it("has an entry for tiers 0-4 with a name and color", () => {
    for (let r = 0; r <= 4; r++) {
      const meta = RARITY_META[r as PillRarity];
      expect(typeof meta.name).toBe("string");
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.color).toMatch(/^(#|var\()/);
    }
  });

  it("getRarityMeta returns the matching entry", () => {
    expect(getRarityMeta(4)).toBe(RARITY_META[4]);
  });
});

describe("rarityPipCount", () => {
  it("bậc 0 sáng 1 pip, bậc 4 sáng đủ 5", () => {
    expect(rarityPipCount(0)).toBe(1);
    expect(rarityPipCount(4)).toBe(RARITY_PIPS);
  });

  it("kẹp bậc vượt khoảng — công pháp có rarity là Int không chặn", () => {
    expect(rarityPipCount(7)).toBe(RARITY_PIPS);
    expect(rarityPipCount(-3)).toBe(1);
  });

  it("làm tròn xuống bậc thập phân", () => {
    expect(rarityPipCount(2.7)).toBe(3);
  });
});
