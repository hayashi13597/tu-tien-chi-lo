import type { RealmConfigDTO } from "./types";

// Client-side mirror of the backend's PUT /admin/realms validation (zod
// per-field ranges + UpdateRealmConfigUseCase's per-realm monotonic rule), so
// the editor can pin errors to fields before a request is ever sent. The
// backend remains the authority — this only has to agree with it.
export interface RealmDraftError {
  realmIndex: number; // -1 for config-wide errors (e.g. no realms at all)
  subIndex: number | null; // null for realm-level errors
  field: string | null; // null for structural errors (e.g. no sub-stages)
  message: string;
}

export function validateRealmDraft(
  realms: RealmConfigDTO[],
): RealmDraftError[] {
  const errors: RealmDraftError[] = [];

  if (realms.length === 0) {
    errors.push({
      realmIndex: -1,
      subIndex: null,
      field: null,
      message: "Cần ít nhất một cảnh giới",
    });
    return errors;
  }

  realms.forEach((realm, realmIndex) => {
    if (realm.name.trim() === "") {
      errors.push({
        realmIndex,
        subIndex: null,
        field: "name",
        message: "Tên cảnh giới không được để trống",
      });
    }
    if (realm.subStages.length === 0) {
      errors.push({
        realmIndex,
        subIndex: null,
        field: null,
        message: "Cảnh giới cần ít nhất một tiểu cảnh giới",
      });
    }

    realm.subStages.forEach((sub, subIndex) => {
      const fail = (field: string, message: string) =>
        errors.push({ realmIndex, subIndex, field, message });

      if (sub.name.trim() === "") fail("name", "Tên không được để trống");
      if (!Number.isFinite(sub.linhKhiRequired) || sub.linhKhiRequired <= 0)
        fail("linhKhiRequired", "Phải là số > 0");
      if (!Number.isFinite(sub.cultivationRate) || sub.cultivationRate <= 0)
        fail("cultivationRate", "Phải là số > 0");
      if (
        !Number.isFinite(sub.baseSuccessRate) ||
        sub.baseSuccessRate < 0 ||
        sub.baseSuccessRate > 100
      )
        fail("baseSuccessRate", "Trong khoảng 0–100");
      if (
        !Number.isFinite(sub.maxSuccessRate) ||
        sub.maxSuccessRate < 0 ||
        sub.maxSuccessRate > 100
      )
        fail("maxSuccessRate", "Trong khoảng 0–100");
      if (!Number.isFinite(sub.pityIncrement) || sub.pityIncrement < 0)
        fail("pityIncrement", "Phải là số ≥ 0");
      if (
        !Number.isFinite(sub.punishmentSeconds) ||
        !Number.isInteger(sub.punishmentSeconds) ||
        sub.punishmentSeconds < 0
      )
        fail("punishmentSeconds", "Số nguyên ≥ 0");

      // Monotonic linh khí WITHIN the realm only — each new realm may reset
      // lower (the seeded balance does), matching the backend invariant.
      if (subIndex > 0) {
        const prev = realm.subStages[subIndex - 1].linhKhiRequired;
        if (
          Number.isFinite(sub.linhKhiRequired) &&
          Number.isFinite(prev) &&
          sub.linhKhiRequired <= prev
        ) {
          fail("linhKhiRequired", "Phải lớn hơn tiểu cảnh giới trước");
        }
      }
    });
  });

  return errors;
}

export function findError(
  errors: RealmDraftError[],
  realmIndex: number,
  subIndex: number | null,
  field: string | null,
): RealmDraftError | undefined {
  return errors.find(
    (e) =>
      e.realmIndex === realmIndex &&
      e.subIndex === subIndex &&
      e.field === field,
  );
}
