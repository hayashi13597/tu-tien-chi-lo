import type { AdminPillDTO, PillEffectKind } from "./types";

// Client-side mirror of the backend's pill validation (zod shape checks +
// domain validatePillDefinition), so the editor pins errors to fields before a
// request is ever sent. The backend remains the authority — this only has to
// agree with it. Same pattern as realm-validation.ts.
export interface PillDraftError {
  field: string;
  message: string;
}

export function validatePillDraft(
  pill: AdminPillDTO,
  opts: { isNew: boolean },
): PillDraftError[] {
  const errors: PillDraftError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });

  // The id is chosen once at creation (kebab-case slug) and immutable after —
  // when editing, it is read-only and never re-validated.
  if (opts.isNew && !/^[a-z0-9-]+$/.test(pill.id)) {
    fail("id", "Chỉ gồm a-z, 0-9 và dấu gạch ngang");
  }
  if (pill.name.trim() === "") fail("name", "Tên không được để trống");
  if (pill.glyph.trim() === "") fail("glyph", "Không được để trống");
  if (pill.desc.trim() === "") fail("desc", "Mô tả không được để trống");
  if (!Number.isInteger(pill.rarity) || pill.rarity < 0 || pill.rarity > 4) {
    fail("rarity", "Độ hiếm trong khoảng 0–4");
  }
  if (!Number.isInteger(pill.starterQuantity) || pill.starterQuantity < 0) {
    fail("starterQuantity", "Số nguyên ≥ 0");
  }

  // Per-kind stat requirements — NaN (empty numeric input) fails all of these.
  // The orphan rule (non-kind fields must be null) needs no check here: the
  // form nulls them automatically when the effect kind changes.
  if (
    pill.effectKind === "linhKhi" &&
    !(pill.amount !== null && pill.amount > 0)
  ) {
    fail("amount", "Phải là số > 0");
  }
  if (pill.effectKind === "cultivationBuff") {
    if (!(pill.multiplier !== null && pill.multiplier > 1)) {
      fail("multiplier", "Phải là số > 1");
    }
    if (
      !(
        pill.durationSec !== null &&
        Number.isInteger(pill.durationSec) &&
        pill.durationSec > 0
      )
    ) {
      fail("durationSec", "Số nguyên > 0");
    }
  }
  if (
    pill.effectKind === "breakthroughBoost" &&
    !(pill.bonusPct !== null && pill.bonusPct > 0)
  ) {
    fail("bonusPct", "Phải là số > 0");
  }

  return errors;
}

export function findPillError(
  errors: PillDraftError[],
  field: string,
): PillDraftError | undefined {
  return errors.find((e) => e.field === field);
}

// Referenced for parity with the backend's KIND_FIELDS table; the page uses
// this to decide which stat inputs to render for the selected effect kind.
export const PILL_KIND_FIELDS: Record<
  PillEffectKind,
  Array<"amount" | "multiplier" | "durationSec" | "bonusPct">
> = {
  linhKhi: ["amount"],
  cultivationBuff: ["multiplier", "durationSec"],
  breakthroughBoost: ["bonusPct"],
  clearPunishment: [],
};
