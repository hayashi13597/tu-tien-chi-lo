import type {
  AlchemyRecipeDTO,
  ExpeditionBranchDTO,
  ExpeditionDifficultyKey,
  MaterialDTO,
} from "./types";

export interface AdminCatalogDraftError {
  path: string;
  message: string;
}

const SLUG = /^[a-z0-9-]+$/;
const DIFFICULTIES: ExpeditionDifficultyKey[] = ["easy", "normal", "hard"];

function isSlug(value: string): boolean {
  return SLUG.test(value);
}

function finiteInteger(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

export function validateMaterialCatalog(
  materials: MaterialDTO[],
): AdminCatalogDraftError[] {
  const errors: AdminCatalogDraftError[] = [];
  const ids = new Set<string>();

  if (materials.length === 0) {
    errors.push({ path: "materials", message: "Cần ít nhất một nguyên liệu" });
  }

  materials.forEach((material, index) => {
    const path = (field: string) => `${index}.${field}`;
    if (!isSlug(material.id)) {
      errors.push({
        path: path("id"),
        message: "Chỉ gồm a-z, 0-9 và dấu gạch ngang",
      });
    }
    if (ids.has(material.id)) {
      errors.push({ path: path("id"), message: "ID nguyên liệu bị trùng" });
    }
    ids.add(material.id);
    if (material.name.trim() === "") {
      errors.push({ path: path("name"), message: "Tên không được để trống" });
    }
    if (material.glyph.trim() === "") {
      errors.push({
        path: path("glyph"),
        message: "Glyph không được để trống",
      });
    }
    if (material.description.trim() === "") {
      errors.push({
        path: path("description"),
        message: "Mô tả không được để trống",
      });
    }
    if (!finiteInteger(material.rarity) || material.rarity < 0) {
      errors.push({
        path: path("rarity"),
        message: "Độ hiếm phải là số nguyên ≥ 0",
      });
    }
    // Mirror backend materialCatalogRowSchema (admin.schemas.ts): tier int 1..3.
    if (
      !finiteInteger(material.tier) ||
      material.tier < 1 ||
      material.tier > 3
    ) {
      errors.push({
        path: path("tier"),
        message: "Bậc phải là số nguyên trong khoảng 1–3",
      });
    }
  });

  return errors;
}

// Mirror backend validateRecipe (domain/alchemy/alchemy.calc.ts): cấp Đan Sư
// tối thiểu gắn cứng theo bậc công thức.
const MIN_RANK_BY_TIER: Record<number, number> = { 1: 1, 2: 4, 3: 7 };

export function validateAlchemyRecipes(
  recipes: AlchemyRecipeDTO[],
): AdminCatalogDraftError[] {
  const errors: AdminCatalogDraftError[] = [];
  const ids = new Set<string>();
  const pillIds = new Set<string>();

  if (recipes.length === 0) {
    errors.push({ path: "recipes", message: "Cần ít nhất một công thức" });
  }

  recipes.forEach((recipe, recipeIndex) => {
    const path = (field: string) => `${recipeIndex}.${field}`;
    if (!isSlug(recipe.id)) {
      errors.push({
        path: path("id"),
        message: "ID chỉ gồm a-z, 0-9 và dấu gạch ngang",
      });
    }
    if (ids.has(recipe.id)) {
      errors.push({ path: path("id"), message: "ID công thức bị trùng" });
    }
    ids.add(recipe.id);
    if (!isSlug(recipe.pillId)) {
      errors.push({
        path: path("pillId"),
        message: "Cần chọn một đan dược hợp lệ",
      });
    }
    if (pillIds.has(recipe.pillId)) {
      errors.push({
        path: path("pillId"),
        message: "Một đan dược không thể có hai công thức",
      });
    }
    pillIds.add(recipe.pillId);
    if (!finiteInteger(recipe.durationSec) || recipe.durationSec <= 0) {
      errors.push({
        path: path("durationSec"),
        message: "Phải là số nguyên > 0",
      });
    }
    if (!finiteInteger(recipe.linhThachCost) || recipe.linhThachCost < 0) {
      errors.push({
        path: path("linhThachCost"),
        message: "Phải là số nguyên ≥ 0",
      });
    }
    // Mirror backend validateRecipe: tier int 1..3.
    if (!finiteInteger(recipe.tier) || recipe.tier < 1 || recipe.tier > 3) {
      errors.push({
        path: path("tier"),
        message: "Bậc phải là số nguyên trong khoảng 1–3",
      });
    }
    // Mirror backend validateRecipe: baseSuccessPct int 5..100.
    if (
      !finiteInteger(recipe.baseSuccessPct) ||
      recipe.baseSuccessPct < 5 ||
      recipe.baseSuccessPct > 100
    ) {
      errors.push({
        path: path("baseSuccessPct"),
        message: "Phải là số nguyên trong khoảng 5–100",
      });
    }
    // Mirror backend validateRecipe: minAlchemyRank === MIN_RANK_BY_TIER[tier]
    // (tier ngoài 1..3 thì map tra undefined → rule này cũng fail như backend).
    if (
      !finiteInteger(recipe.minAlchemyRank) ||
      recipe.minAlchemyRank !== MIN_RANK_BY_TIER[recipe.tier]
    ) {
      errors.push({
        path: path("minAlchemyRank"),
        message: "Phải là 1/4/7 tương ứng bậc 1/2/3",
      });
    }
    if (recipe.ingredients.length === 0) {
      errors.push({
        path: path("ingredients"),
        message: "Cần ít nhất một nguyên liệu đầu vào",
      });
    }

    const materialIds = new Set<string>();
    recipe.ingredients.forEach((ingredient, ingredientIndex) => {
      const ingredientPath = (field: string) =>
        `${recipeIndex}.ingredients.${ingredientIndex}.${field}`;
      if (!isSlug(ingredient.materialId)) {
        errors.push({
          path: ingredientPath("materialId"),
          message: "Cần chọn nguyên liệu hợp lệ",
        });
      }
      if (materialIds.has(ingredient.materialId)) {
        errors.push({
          path: ingredientPath("materialId"),
          message: "Nguyên liệu không được lặp trong một công thức",
        });
      }
      materialIds.add(ingredient.materialId);
      if (!finiteInteger(ingredient.quantity) || ingredient.quantity <= 0) {
        errors.push({
          path: ingredientPath("quantity"),
          message: "Phải là số nguyên > 0",
        });
      }
    });
  });

  return errors;
}

export function validateExpeditionConfig(
  branches: ExpeditionBranchDTO[],
): AdminCatalogDraftError[] {
  const errors: AdminCatalogDraftError[] = [];
  const branchIds = new Set<string>();

  if (branches.length === 0) {
    errors.push({ path: "branches", message: "Cần ít nhất một nhánh bí cảnh" });
  }

  branches.forEach((bundle, branchIndex) => {
    const branch = bundle.branch;
    const branchPath = (field: string) => `${branchIndex}.branch.${field}`;
    if (!isSlug(branch.id)) {
      errors.push({
        path: branchPath("id"),
        message: "ID chỉ gồm a-z, 0-9 và dấu gạch ngang",
      });
    }
    if (branchIds.has(branch.id)) {
      errors.push({
        path: branchPath("id"),
        message: "ID nhánh bí cảnh bị trùng",
      });
    }
    branchIds.add(branch.id);
    if (branch.name.trim() === "") {
      errors.push({
        path: branchPath("name"),
        message: "Tên không được để trống",
      });
    }
    if (branch.glyph.trim() === "") {
      errors.push({
        path: branchPath("glyph"),
        message: "Glyph không được để trống",
      });
    }
    if (branch.description.trim() === "") {
      errors.push({
        path: branchPath("description"),
        message: "Mô tả không được để trống",
      });
    }
    if (!Number.isFinite(branch.basePower) || branch.basePower <= 0) {
      errors.push({ path: branchPath("basePower"), message: "Phải là số > 0" });
    }
    if (!isSlug(branch.alchemyMaterialId)) {
      errors.push({
        path: branchPath("alchemyMaterialId"),
        message: "Cần chọn nguyên liệu luyện đan",
      });
    }

    if (branch.upgradeMaterialWeights.length === 0) {
      errors.push({
        path: branchPath("upgradeMaterialWeights"),
        message: "Cần ít nhất một trọng số nguyên liệu",
      });
    }
    const weightMaterialIds = new Set<string>();
    branch.upgradeMaterialWeights.forEach((weight, weightIndex) => {
      const weightPath = (field: string) =>
        `${branchIndex}.branch.upgradeMaterialWeights.${weightIndex}.${field}`;
      if (!isSlug(weight.materialId)) {
        errors.push({
          path: weightPath("materialId"),
          message: "Cần chọn nguyên liệu hợp lệ",
        });
      }
      if (weightMaterialIds.has(weight.materialId)) {
        errors.push({
          path: weightPath("materialId"),
          message: "Nguyên liệu không được lặp trong trọng số",
        });
      }
      weightMaterialIds.add(weight.materialId);
      if (!Number.isFinite(weight.weight) || weight.weight < 0) {
        errors.push({ path: weightPath("weight"), message: "Phải là số ≥ 0" });
      }
    });

    const difficultyKeys = new Set<ExpeditionDifficultyKey>();
    bundle.difficulties.forEach((difficulty, difficultyIndex) => {
      const difficultyPath = (field: string) =>
        `${branchIndex}.difficulties.${difficultyIndex}.${field}`;
      difficultyKeys.add(difficulty.key);
      if (
        !Number.isFinite(difficulty.enemyMultiplier) ||
        difficulty.enemyMultiplier <= 0
      ) {
        errors.push({
          path: difficultyPath("enemyMultiplier"),
          message: "Phải là số > 0",
        });
      }
      if (
        !Number.isFinite(difficulty.normalDropRate) ||
        difficulty.normalDropRate < 0 ||
        difficulty.normalDropRate > 1
      ) {
        errors.push({
          path: difficultyPath("normalDropRate"),
          message: "Trong khoảng 0–1",
        });
      }
      if (
        !Number.isFinite(difficulty.bossDropRate) ||
        difficulty.bossDropRate < 0 ||
        difficulty.bossDropRate > 1
      ) {
        errors.push({
          path: difficultyPath("bossDropRate"),
          message: "Trong khoảng 0–1",
        });
      }
      if (
        !Number.isFinite(difficulty.rewardMultiplier) ||
        difficulty.rewardMultiplier <= 0
      ) {
        errors.push({
          path: difficultyPath("rewardMultiplier"),
          message: "Phải là số > 0",
        });
      }
      if (
        !Number.isFinite(difficulty.adaptiveCoefficient) ||
        difficulty.adaptiveCoefficient < 0
      ) {
        errors.push({
          path: difficultyPath("adaptiveCoefficient"),
          message: "Phải là số ≥ 0",
        });
      }
    });
    if (
      bundle.difficulties.length !== DIFFICULTIES.length ||
      DIFFICULTIES.some((key) => !difficultyKeys.has(key))
    ) {
      errors.push({
        path: `${branchIndex}.difficulties`,
        message: "Phải có đủ dễ, thường và khó",
      });
    }
  });

  return errors;
}

export function findAdminCatalogError(
  errors: AdminCatalogDraftError[],
  path: string,
): AdminCatalogDraftError | undefined {
  return errors.find((error) => error.path === path);
}
