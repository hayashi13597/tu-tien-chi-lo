import { describe, expect, it } from "vitest";
import { getRarityMeta, RARITY_META } from "./pill-constants";
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
