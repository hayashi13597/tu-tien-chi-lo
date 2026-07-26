import { ATTRIBUTE_ORDER } from "./attribute-constants";
import type { CongPhapDTO } from "./types";

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

  if (def.category === "passive") {
    if (!def.effects || def.effects.length === 0) {
      fail("effects", "Công pháp bị động cần ít nhất một hiệu ứng");
    } else {
      for (const e of def.effects) {
        if (!ATTRIBUTE_ORDER.includes(e.attribute)) {
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

  return errors;
}

export function findCongPhapError(
  errors: CongPhapDraftError[],
  field: string,
): CongPhapDraftError | undefined {
  return errors.find((e) => e.field === field);
}
