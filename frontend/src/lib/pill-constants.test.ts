import { describe, expect, it } from "vitest";
import { PILL_DEFS, RARITY_META, SEED_INVENTORY } from "./pill-constants";

const EFFECT_KINDS = [
  "linhKhi",
  "cultivationBuff",
  "breakthroughBoost",
  "clearPunishment",
] as const;

describe("pill-constants", () => {
  it("has a rarity meta entry for tiers 0-4", () => {
    for (let r = 0; r <= 4; r++) {
      expect(RARITY_META[r as 0]).toBeDefined();
      expect(typeof RARITY_META[r as 0].name).toBe("string");
      expect(RARITY_META[r as 0].color).toMatch(/^(#|var\()/);
    }
  });

  it("gives every pill a valid rarity 0-4", () => {
    for (const p of PILL_DEFS) {
      expect(p.rarity).toBeGreaterThanOrEqual(0);
      expect(p.rarity).toBeLessThanOrEqual(4);
    }
  });

  it("gives every pill exactly one known effect kind", () => {
    for (const p of PILL_DEFS) {
      expect(EFFECT_KINDS).toContain(p.effect.kind);
    }
  });

  it("populates the required field for each effect kind", () => {
    for (const p of PILL_DEFS) {
      const e = p.effect;
      if (e.kind === "linhKhi") expect(e.amount).toBeGreaterThan(0);
      if (e.kind === "cultivationBuff") {
        expect(e.multiplier).toBeGreaterThan(1);
        expect(e.durationSec).toBeGreaterThan(0);
      }
      if (e.kind === "breakthroughBoost") expect(e.bonusPct).toBeGreaterThan(0);
      // clearPunishment needs no numeric field.
    }
  });

  it("covers all four effect kinds across the catalog", () => {
    const kinds = new Set(PILL_DEFS.map((p) => p.effect.kind));
    for (const k of EFFECT_KINDS) expect(kinds).toContain(k);
  });

  it("has unique pill ids", () => {
    const ids = PILL_DEFS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("seeds inventory only with catalog pills and positive quantities", () => {
    const catalogIds = new Set(PILL_DEFS.map((p) => p.id));
    for (const item of SEED_INVENTORY) {
      expect(catalogIds.has(item.def.id)).toBe(true);
      expect(item.quantity).toBeGreaterThan(0);
    }
  });
});
