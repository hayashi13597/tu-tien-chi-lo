import { describe, expect, it } from "vitest";
import {
  findCongPhapError,
  validateCongPhapDraft,
} from "./congphap-validation";
import type { CongPhapDTO } from "./types";

const passive: CongPhapDTO = {
  id: "thiet-cot-quyet",
  name: "Thiết Cốt",
  glyph: "铁",
  rarity: 1,
  category: "passive",
  desc: "d",
  active: true,
  maxLevel: 10,
  baseCost: 100,
  costGrowth: 1.5,
  upgradeMaterialId: null,
  baseMaterialCost: 0,
  materialCostGrowth: 1,
  effects: [{ attribute: "khiHuyet", flatPerLevel: 50, pctPerLevel: 0 }],
  powerPerLevel: null,
  chanNguyenCost: null,
  dupRefundLinhThach: null,
  tier: 1,
  branch: "chienDao" as const,
  minRealmMajor: 0,
  biTichMaterialId: null,
};

const active: CongPhapDTO = {
  ...passive,
  id: "liet-hoa",
  category: "active",
  effects: null,
  powerPerLevel: 120,
  chanNguyenCost: 30,
};

const fields = (draft: CongPhapDTO, isNew = true) =>
  validateCongPhapDraft(draft, { isNew }).map((e) => e.field);

describe("validateCongPhapDraft", () => {
  it("accepts valid passive and active drafts", () => {
    expect(validateCongPhapDraft(passive, { isNew: true })).toEqual([]);
    expect(validateCongPhapDraft(active, { isNew: true })).toEqual([]);
  });

  it("checks the id slug only when creating", () => {
    expect(fields({ ...passive, id: "Bad_Id" }, true)).toContain("id");
    expect(fields({ ...passive, id: "Bad_Id" }, false)).not.toContain("id");
  });

  it("rejects empty text fields", () => {
    expect(fields({ ...passive, name: "  " })).toContain("name");
    expect(fields({ ...passive, glyph: "" })).toContain("glyph");
    expect(fields({ ...passive, desc: "" })).toContain("desc");
  });

  it("rejects out-of-range level and cost tuning", () => {
    expect(fields({ ...passive, maxLevel: 0 })).toContain("maxLevel");
    expect(fields({ ...passive, baseCost: -1 })).toContain("baseCost");
    expect(fields({ ...passive, costGrowth: 0.9 })).toContain("costGrowth");
  });

  // Empty numeric inputs surface as NaN — they must block Save, never coerce to 0.
  it("rejects NaN from empty numeric inputs", () => {
    expect(fields({ ...passive, maxLevel: Number.NaN })).toContain("maxLevel");
    expect(fields({ ...passive, baseCost: Number.NaN })).toContain("baseCost");
    expect(fields({ ...active, powerPerLevel: Number.NaN })).toContain(
      "powerPerLevel",
    );
  });

  it("requires at least one well-formed effect on a passive", () => {
    expect(fields({ ...passive, effects: [] })).toContain("effects");
    expect(fields({ ...passive, effects: null })).toContain("effects");
    expect(
      fields({
        ...passive,
        effects: [
          { attribute: "khiHuyet", flatPerLevel: Number.NaN, pctPerLevel: 0 },
        ],
      }),
    ).toContain("effects");
  });

  it("requires powerPerLevel > 0 on an active", () => {
    expect(fields({ ...active, powerPerLevel: 0 })).toContain("powerPerLevel");
    expect(fields({ ...active, powerPerLevel: null })).toContain(
      "powerPerLevel",
    );
  });

  it("rejects a negative chanNguyenCost but allows null", () => {
    expect(fields({ ...active, chanNguyenCost: -1 })).toContain(
      "chanNguyenCost",
    );
    expect(fields({ ...active, chanNguyenCost: null })).toEqual([]);
  });

  it("validates dupRefundLinhThach when set", () => {
    expect(fields({ ...passive, dupRefundLinhThach: -5 })).toContain(
      "dupRefundLinhThach",
    );
    expect(fields({ ...passive, dupRefundLinhThach: 250 })).toEqual([]);
  });

  it("validates material costs for công pháp upgrades", () => {
    expect(
      fields({
        ...passive,
        upgradeMaterialId: "xich-viem-tinh",
        baseMaterialCost: 2,
        materialCostGrowth: 1.2,
      }),
    ).toEqual([]);
    expect(fields({ ...passive, upgradeMaterialId: "Bad_Id" })).toContain(
      "upgradeMaterialId",
    );
    expect(fields({ ...passive, baseMaterialCost: -1 })).toContain(
      "baseMaterialCost",
    );
    expect(fields({ ...passive, materialCostGrowth: 0.9 })).toContain(
      "materialCostGrowth",
    );
    expect(
      fields({ ...passive, baseMaterialCost: 2, upgradeMaterialId: null }),
    ).toContain("upgradeMaterialId");
  });

  it("findCongPhapError locates a field's message", () => {
    const errors = validateCongPhapDraft(
      { ...passive, name: "" },
      { isNew: true },
    );
    expect(findCongPhapError(errors, "name")?.message).toBeTruthy();
    expect(findCongPhapError(errors, "glyph")).toBeUndefined();
  });
});
