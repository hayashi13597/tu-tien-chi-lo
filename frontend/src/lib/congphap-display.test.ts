import { describe, expect, it } from "vitest";
import {
  attributeDelta,
  formatMaterialBalance,
  formatUpgradeCost,
  getCongPhapRarityMeta,
  levelUpCost,
  materialUpgradeCost,
  passiveBonusAt,
  skillPowerAt,
} from "./congphap-display";
import type { AttributeSet, CongPhapDTO } from "./types";

const passive: CongPhapDTO = {
  id: "p",
  name: "P",
  glyph: "p",
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
  effects: [
    { attribute: "khiHuyet", flatPerLevel: 50, pctPerLevel: 0 },
    { attribute: "tocDo", flatPerLevel: 0, pctPerLevel: 2 },
  ],
  powerPerLevel: null,
  chanNguyenCost: null,
  dupRefundLinhThach: null,
};

const active: CongPhapDTO = {
  ...passive,
  id: "a",
  category: "active",
  effects: null,
  powerPerLevel: 120,
  chanNguyenCost: 30,
};

describe("levelUpCost", () => {
  it("level 1→2 costs exactly baseCost", () => {
    expect(levelUpCost(passive, 1)).toBe(100);
  });
  it("grows geometrically by costGrowth, rounded", () => {
    expect(levelUpCost(passive, 2)).toBe(150); // 100 × 1.5
    expect(levelUpCost(passive, 3)).toBe(225); // 100 × 1.5²
  });
});

describe("material upgrade cost", () => {
  it("mirrors the backend material cost growth", () => {
    const def = {
      ...passive,
      upgradeMaterialId: "xich-viem-tinh",
      baseMaterialCost: 2,
      materialCostGrowth: 1.5,
    };
    expect(materialUpgradeCost(def, 1)).toBe(2);
    expect(materialUpgradeCost(def, 2)).toBe(3);
  });

  it("formats both Linh Thạch and named material costs", () => {
    expect(
      formatUpgradeCost({
        linhThach: 100,
        material: 3,
        materialName: "Xích Viêm Tinh",
      }),
    ).toBe("100 Linh Thạch · 3 Xích Viêm Tinh");
  });

  it("shows current material balance against the required amount", () => {
    expect(formatMaterialBalance(3, 5, "Xích Viêm Tinh")).toBe(
      "3/5 Xích Viêm Tinh",
    );
  });
});

describe("passiveBonusAt", () => {
  it("scales each effect by level", () => {
    const bonus = passiveBonusAt(passive, 3);
    expect(bonus.khiHuyet).toEqual({ flat: 150, pct: 0 });
    expect(bonus.tocDo).toEqual({ flat: 0, pct: 6 });
  });
  it("is empty for an active công pháp", () => {
    expect(passiveBonusAt(active, 5)).toEqual({});
  });
});

describe("skillPowerAt", () => {
  it("multiplies powerPerLevel by level", () => {
    expect(skillPowerAt(active, 4)).toBe(480);
  });
  it("is null for a passive công pháp", () => {
    expect(skillPowerAt(passive, 4)).toBeNull();
  });
});

describe("getCongPhapRarityMeta", () => {
  it("maps in-range rarity like pills do", () => {
    expect(getCongPhapRarityMeta(4).name).toBe("Tuyệt phẩm");
  });
  // The backend stores rarity as a plain Int with no 0–4 bound, so an admin
  // can save 7; clamping keeps the UI from reading undefined.color.
  it("clamps above and below the 0–4 range", () => {
    expect(getCongPhapRarityMeta(99)).toEqual(getCongPhapRarityMeta(4));
    expect(getCongPhapRarityMeta(-3)).toEqual(getCongPhapRarityMeta(0));
  });
  it("floors a non-integer rarity", () => {
    expect(getCongPhapRarityMeta(2.9)).toEqual(getCongPhapRarityMeta(2));
  });
});

describe("attributeDelta", () => {
  it("reports final − base per attribute", () => {
    const base: AttributeSet = {
      khiHuyet: 100,
      chanNguyen: 80,
      congVatLy: 20,
      congPhep: 20,
      phongThu: 10,
      tocDo: 5,
    };
    const final: AttributeSet = { ...base, khiHuyet: 250, phongThu: 18 };
    const delta = attributeDelta(base, final);
    expect(delta.khiHuyet).toBe(150);
    expect(delta.phongThu).toBe(8);
    expect(delta.tocDo).toBe(0);
  });
});
