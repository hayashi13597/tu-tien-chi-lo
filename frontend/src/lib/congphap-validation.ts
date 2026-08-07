import { ATTRIBUTE_ORDER, SYSTEM_EFFECT_LABELS } from "./attribute-constants";
import type { CongPhapDTO } from "./types";

const SLUG = /^[a-z0-9-]+$/;
const SYSTEM_EFFECT_KEYS = Object.keys(SYSTEM_EFFECT_LABELS);

// Client-side mirror of the backend's công pháp validation (zod shape checks +
// domain validateCongPhapDefinition), so the editor pins errors to fields
// before a request is sent. The backend remains the authority — this only has
// to agree with it. Same pattern as pill-validation.ts.
export interface CongPhapDraftError {
  field: string;
  message: string;
}

export function validateCongPhapDraft(
  def: CongPhapDTO,
  opts: { isNew: boolean },
): CongPhapDraftError[] {
  const errors: CongPhapDraftError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });

  // The id is chosen once at creation and immutable after (OwnedCongPhap FK).
  if (opts.isNew && !/^[a-z0-9-]+$/.test(def.id)) {
    fail("id", "Chỉ gồm a-z, 0-9 và dấu gạch ngang");
  }
  if (def.name.trim() === "") fail("name", "Tên không được để trống");
  if (def.glyph.trim() === "") fail("glyph", "Không được để trống");
  if (def.desc.trim() === "") fail("desc", "Mô tả không được để trống");
  if (!Number.isFinite(def.rarity)) fail("rarity", "Phải là một số");
  if (!Number.isInteger(def.maxLevel) || def.maxLevel < 1) {
    fail("maxLevel", "Số nguyên ≥ 1");
  }
  if (!Number.isInteger(def.baseCost) || def.baseCost < 0) {
    fail("baseCost", "Số nguyên ≥ 0");
  }
  if (!(def.costGrowth >= 1)) fail("costGrowth", "Phải là số ≥ 1");
  if (
    def.dupRefundLinhThach !== null &&
    (!Number.isInteger(def.dupRefundLinhThach) || def.dupRefundLinhThach < 0)
  ) {
    fail("dupRefundLinhThach", "Bỏ trống hoặc số nguyên ≥ 0");
  }
  if (def.upgradeMaterialId !== null && !SLUG.test(def.upgradeMaterialId)) {
    fail(
      "upgradeMaterialId",
      "ID nguyên liệu chỉ gồm a-z, 0-9 và dấu gạch ngang",
    );
  }
  if (!Number.isInteger(def.baseMaterialCost) || def.baseMaterialCost < 0) {
    fail("baseMaterialCost", "Số nguyên ≥ 0");
  }
  if (!(def.materialCostGrowth >= 1)) {
    fail("materialCostGrowth", "Phải là số ≥ 1");
  }
  if (def.baseMaterialCost > 0 && def.upgradeMaterialId === null) {
    fail(
      "upgradeMaterialId",
      "Cần chọn nguyên liệu khi có chi phí nguyên liệu",
    );
  }

  if (def.category === "passive") {
    if (!def.effects || def.effects.length === 0) {
      fail("effects", "Công pháp bị động cần ít nhất một hiệu ứng");
    } else {
      for (const e of def.effects) {
        const isSystemKey = SYSTEM_EFFECT_KEYS.includes(e.attribute);
        if (!isSystemKey && !ATTRIBUTE_ORDER.includes(e.attribute as never)) {
          fail("effects", `Thuộc tính không hợp lệ: "${e.attribute}"`);
          break;
        }
        // NaN from an emptied numeric input must block Save, not become 0.
        if (
          !Number.isFinite(e.flatPerLevel) ||
          !Number.isFinite(e.pctPerLevel)
        ) {
          fail("effects", "Giá trị hiệu ứng phải là số");
          break;
        }
        // Mirror backend validate: buff hệ thống là % thuần (flat = 0, pct > 0).
        if (isSystemKey && (e.flatPerLevel !== 0 || e.pctPerLevel <= 0)) {
          fail("effects", "Hiệu ứng hệ thống: flat phải = 0 và % phải > 0");
          break;
        }
      }
    }
  } else {
    if (!(def.powerPerLevel !== null && def.powerPerLevel > 0)) {
      fail("powerPerLevel", "Phải là số > 0");
    }
    if (def.chanNguyenCost !== null && !(def.chanNguyenCost >= 0)) {
      fail("chanNguyenCost", "Bỏ trống hoặc số ≥ 0");
    }
  }

  // Phase 2 (mirror backend domain/congphap/congphap.validate.ts):
  if (!Number.isInteger(def.tier) || def.tier < 1 || def.tier > 3) {
    fail("tier", "Số nguyên từ 1 đến 3");
  }
  if (!Number.isInteger(def.minRealmMajor) || def.minRealmMajor < 0) {
    fail("minRealmMajor", "Số nguyên ≥ 0");
  }
  if (def.tier >= 2) {
    if (def.branch === null) fail("branch", "Môn từ tier 2 bắt buộc thuộc một nhánh");
    if (def.biTichMaterialId === null) fail("biTichMaterialId", "Môn từ tier 2 cần Bí Tịch nhập môn");
  }

  return errors;
}

export function findCongPhapError(
  errors: CongPhapDraftError[],
  field: string,
): CongPhapDraftError | undefined {
  return errors.find((e) => e.field === field);
}
