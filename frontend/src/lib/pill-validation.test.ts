import { describe, expect, it } from "vitest";
import { findPillError, validatePillDraft } from "./pill-validation";
import type { AdminPillDTO } from "./types";

function pill(over: Partial<AdminPillDTO> = {}): AdminPillDTO {
  return {
    id: "test-dan",
    name: "Test Đan",
    glyph: "试",
    rarity: 0,
    tier: 1,
    effectKind: "linhKhi",
    amount: 50,
    multiplier: null,
    durationSec: null,
    bonusPct: null,
    // Phase 3 — mặc định không phải đan combat.
    combatAttribute: null,
    combatTrigger: null,
    desc: "mô tả",
    active: true,
    starterQuantity: 0,
    ...over,
  };
}

describe("validatePillDraft", () => {
  it("accepts a valid pill of each effect kind", () => {
    expect(validatePillDraft(pill(), { isNew: false })).toEqual([]);
    expect(
      validatePillDraft(
        pill({
          effectKind: "cultivationBuff",
          amount: null,
          multiplier: 1.5,
          durationSec: 60,
        }),
        { isNew: false },
      ),
    ).toEqual([]);
    expect(
      validatePillDraft(
        pill({ effectKind: "breakthroughBoost", amount: null, bonusPct: 15 }),
        { isNew: false },
      ),
    ).toEqual([]);
    expect(
      validatePillDraft(pill({ effectKind: "clearPunishment", amount: null }), {
        isNew: false,
      }),
    ).toEqual([]);
  });

  it("checks the id slug only when creating", () => {
    const bad = pill({ id: "Xấu Id!" });
    expect(
      findPillError(validatePillDraft(bad, { isNew: true }), "id"),
    ).toBeDefined();
    // When editing, the id is server-fixed and read-only — never re-validated.
    expect(
      findPillError(validatePillDraft(bad, { isNew: false }), "id"),
    ).toBeUndefined();
  });

  it("flags empty name/glyph/desc and bad rarity/starterQuantity", () => {
    const errors = validatePillDraft(
      pill({
        name: " ",
        glyph: "",
        desc: "",
        rarity: 7 as AdminPillDTO["rarity"],
        starterQuantity: -1,
      }),
      { isNew: false },
    );
    for (const field of [
      "name",
      "glyph",
      "desc",
      "rarity",
      "starterQuantity",
    ]) {
      expect(findPillError(errors, field)).toBeDefined();
    }
  });

  it("requires each kind's stat fields (NaN from an empty input blocks save)", () => {
    expect(
      findPillError(
        validatePillDraft(pill({ amount: null }), { isNew: false }),
        "amount",
      ),
    ).toBeDefined();
    expect(
      findPillError(
        validatePillDraft(pill({ amount: Number.NaN }), { isNew: false }),
        "amount",
      ),
    ).toBeDefined();
    const buff = pill({
      effectKind: "cultivationBuff",
      amount: null,
      multiplier: 1,
      durationSec: 0,
    });
    const errors = validatePillDraft(buff, { isNew: false });
    expect(findPillError(errors, "multiplier")).toBeDefined(); // must be > 1
    expect(findPillError(errors, "durationSec")).toBeDefined(); // must be > 0
    expect(
      findPillError(
        validatePillDraft(
          pill({ effectKind: "breakthroughBoost", amount: null, bonusPct: 0 }),
          { isNew: false },
        ),
        "bonusPct",
      ),
    ).toBeDefined();
  });
});

describe("validatePillDraft — combatBuff (Phase 3)", () => {
  const base = {
    id: "cuong-the-dan",
    name: "Cường Thể Đan",
    glyph: "強",
    rarity: 3 as const,
    tier: 2,
    effectKind: "combatBuff" as const,
    amount: null,
    multiplier: null,
    durationSec: null,
    bonusPct: 25,
    combatAttribute: "congVatLy" as const,
    combatTrigger: "start" as const,
    desc: "d",
    active: true,
    starterQuantity: 0,
  };

  it("hợp lệ khi đủ field", () => {
    expect(validatePillDraft({ ...base }, { isNew: true })).toEqual([]);
  });

  it("thiếu field combat → lỗi từng ô", () => {
    const missingAttr = validatePillDraft(
      { ...base, combatAttribute: null },
      { isNew: true },
    );
    expect(missingAttr.find((e) => e.field === "combatAttribute")).toBeTruthy();
    const missingTrigger = validatePillDraft(
      { ...base, combatTrigger: null },
      { isNew: true },
    );
    expect(
      missingTrigger.find((e) => e.field === "combatTrigger"),
    ).toBeTruthy();
    const noPct = validatePillDraft({ ...base, bonusPct: 0 }, { isNew: true });
    expect(noPct.find((e) => e.field === "bonusPct")).toBeTruthy();
  });

  it("kind thường mang field combat → lỗi orphan", () => {
    const orphan = validatePillDraft(
      { ...base, effectKind: "linhKhi" as const, amount: 50, bonusPct: null },
      { isNew: true },
    );
    expect(orphan.find((e) => e.field === "combatAttribute")).toBeTruthy();
    expect(orphan.find((e) => e.field === "combatTrigger")).toBeTruthy();
  });
});
