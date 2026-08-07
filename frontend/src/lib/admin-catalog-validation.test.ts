import { describe, expect, it } from "vitest";
import {
  findAdminCatalogError,
  validateAlchemyRecipes,
  validateExpeditionConfig,
  validateMaterialCatalog,
} from "./admin-catalog-validation";
import type {
  AlchemyRecipeDTO,
  ExpeditionBranchDTO,
  MaterialDTO,
} from "./types";

const material: MaterialDTO = {
  id: "xich-viem-tinh",
  name: "Xích Viêm Tinh",
  glyph: "炎",
  rarity: 1,
  tier: 1,
  description: "Một tinh thể nóng rực.",
  active: true,
};

const recipe: AlchemyRecipeDTO = {
  id: "hoi-khi-dan",
  pillId: "hoi-khi-dan",
  durationSec: 1800,
  linhThachCost: 10,
  active: true,
  ingredients: [{ materialId: material.id, quantity: 2 }],
  tier: 1,
  minAlchemyRank: 1,
  baseSuccessPct: 100,
};

const branch: ExpeditionBranchDTO = {
  branch: {
    id: "hoa-vuc",
    name: "Hỏa Vực",
    glyph: "火",
    description: "Một bí cảnh đầy hỏa linh khí.",
    basePower: 100,
    alchemyMaterialId: material.id,
    upgradeMaterialWeights: [{ materialId: material.id, weight: 1 }],
    tier: 1,
    minRealmMajor: 0,
    recommendedPower: 0,
    bossDropWeights: [],
  },
  difficulties: [
    {
      key: "easy",
      enemyMultiplier: 0.8,
      normalDropRate: 0.5,
      bossDropRate: 0.8,
      rewardMultiplier: 0.25,
      adaptiveCoefficient: 0.5,
    },
    {
      key: "normal",
      enemyMultiplier: 1,
      normalDropRate: 0.4,
      bossDropRate: 0.7,
      rewardMultiplier: 0.5,
      adaptiveCoefficient: 0.75,
    },
    {
      key: "hard",
      enemyMultiplier: 1.5,
      normalDropRate: 0.3,
      bossDropRate: 0.6,
      rewardMultiplier: 1,
      adaptiveCoefficient: 1,
    },
  ],
};

describe("admin catalog validation", () => {
  it("accepts valid material, recipe and expedition drafts", () => {
    expect(validateMaterialCatalog([material])).toEqual([]);
    expect(validateAlchemyRecipes([recipe])).toEqual([]);
    expect(validateExpeditionConfig([branch])).toEqual([]);
  });

  it("rejects an invalid material id and blank material fields", () => {
    const errors = validateMaterialCatalog([
      { ...material, id: "bad id", name: "", description: "" },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "0.id" }),
        expect.objectContaining({ path: "0.name" }),
        expect.objectContaining({ path: "0.description" }),
      ]),
    );
  });

  it("rejects a material tier outside 1–3", () => {
    expect(
      findAdminCatalogError(
        validateMaterialCatalog([{ ...material, tier: 0 }]),
        "0.tier",
      ),
    ).toBeDefined();
    expect(
      findAdminCatalogError(
        validateMaterialCatalog([{ ...material, tier: 4 }]),
        "0.tier",
      ),
    ).toBeDefined();
  });

  it("rejects duplicate material ids and negative rarity", () => {
    const errors = validateMaterialCatalog([
      material,
      { ...material, name: "Trùng", rarity: -1 },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "1.id" }),
        expect.objectContaining({ path: "1.rarity" }),
      ]),
    );
  });

  it("rejects a recipe tier outside 1–3", () => {
    expect(
      findAdminCatalogError(
        validateAlchemyRecipes([{ ...recipe, tier: 5 }]),
        "0.tier",
      ),
    ).toBeDefined();
  });

  it("rejects baseSuccessPct outside 5–100", () => {
    for (const baseSuccessPct of [4, 120]) {
      expect(
        findAdminCatalogError(
          validateAlchemyRecipes([{ ...recipe, baseSuccessPct }]),
          "0.baseSuccessPct",
        ),
      ).toBeDefined();
    }
  });

  it("rejects minAlchemyRank lệch map bậc (tier 1→1, 2→4, 3→7)", () => {
    expect(
      findAdminCatalogError(
        validateAlchemyRecipes([{ ...recipe, tier: 2, minAlchemyRank: 3 }]),
        "0.minAlchemyRank",
      ),
    ).toBeDefined();
    expect(
      findAdminCatalogError(
        validateAlchemyRecipes([
          { ...recipe, tier: 2, minAlchemyRank: Number.NaN },
        ]),
        "0.minAlchemyRank",
      ),
    ).toBeDefined();
  });

  it("accepts tier/rank đúng map và baseSuccessPct ở biên", () => {
    expect(
      validateAlchemyRecipes([
        { ...recipe, tier: 2, minAlchemyRank: 4, baseSuccessPct: 5 },
      ]),
    ).toEqual([]);
    expect(
      validateAlchemyRecipes([
        { ...recipe, tier: 3, minAlchemyRank: 7, baseSuccessPct: 100 },
      ]),
    ).toEqual([]);
  });

  it("rejects invalid recipe numbers, duplicate outputs and ingredients", () => {
    const errors = validateAlchemyRecipes([
      {
        ...recipe,
        durationSec: Number.NaN,
        ingredients: [
          { materialId: material.id, quantity: 0 },
          { materialId: material.id, quantity: 2 },
        ],
      },
      { ...recipe, id: "another-recipe" },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "0.durationSec" }),
        expect.objectContaining({ path: "0.ingredients.0.quantity" }),
        expect.objectContaining({ path: "0.ingredients.1.materialId" }),
        expect.objectContaining({ path: "1.pillId" }),
      ]),
    );
  });

  it("rejects an incomplete expedition difficulty set and invalid drops", () => {
    const errors = validateExpeditionConfig([
      {
        ...branch,
        difficulties: branch.difficulties.filter((d) => d.key !== "hard"),
        branch: {
          ...branch.branch,
          upgradeMaterialWeights: [
            { materialId: material.id, weight: -1 },
            { materialId: material.id, weight: 0.5 },
          ],
          tier: 1,
          minRealmMajor: 0,
          recommendedPower: 0,
          bossDropWeights: [],
        },
      },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "0.difficulties" }),
        expect.objectContaining({
          path: "0.branch.upgradeMaterialWeights.0.weight",
        }),
        expect.objectContaining({
          path: "0.branch.upgradeMaterialWeights.1.materialId",
        }),
      ]),
    );
  });
});
