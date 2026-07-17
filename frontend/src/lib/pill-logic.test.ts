import { describe, expect, it } from "vitest";
import { applyConsume, expireBuffs } from "./pill-logic";
import type { ActiveBuff, InventoryPill, PillDef } from "./types";

function def(id: string): PillDef {
  return {
    id,
    name: id,
    glyph: "丹",
    rarity: 0,
    effect: { kind: "linhKhi", amount: 1 },
    desc: "",
  };
}

describe("applyConsume", () => {
  it("decrements quantity by one", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 3 }];
    expect(applyConsume(inv, "a")[0].quantity).toBe(2);
  });

  it("removes the item when quantity hits zero", () => {
    const inv: InventoryPill[] = [
      { def: def("a"), quantity: 1 },
      { def: def("b"), quantity: 2 },
    ];
    const next = applyConsume(inv, "a");
    expect(next.map((i) => i.def.id)).toEqual(["b"]);
  });

  it("is a no-op for an unknown id", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 1 }];
    expect(applyConsume(inv, "zzz")).toEqual(inv);
  });

  it("does not mutate the input array", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 2 }];
    applyConsume(inv, "a");
    expect(inv[0].quantity).toBe(2);
  });
});

describe("expireBuffs", () => {
  const active: ActiveBuff = {
    kind: "cultivationBuff",
    label: "x",
    expiresAt: 1000,
    multiplier: 2,
  };
  const boost: ActiveBuff = {
    kind: "breakthroughBoost",
    label: "y",
    bonusPct: 10,
  };

  it("drops buffs whose expiresAt is at or before now", () => {
    expect(expireBuffs([active], 1000)).toEqual([]);
    expect(expireBuffs([active], 1500)).toEqual([]);
  });

  it("keeps buffs whose expiresAt is after now", () => {
    expect(expireBuffs([active], 999)).toEqual([active]);
  });

  it("keeps buffs with no expiresAt (one-shot boosts)", () => {
    expect(expireBuffs([boost], 999999)).toEqual([boost]);
  });
});
