import type { AdminRedeemCodeDTO } from "./types";

export interface RedeemDraftError {
  field: string;
  message: string;
}

export function validateRedeemDraft(
  draft: Omit<AdminRedeemCodeDTO, "redeemedCount">,
  opts: { isNew: boolean },
): RedeemDraftError[] {
  const errors: RedeemDraftError[] = [];
  const fail = (field: string, message: string) => errors.push({ field, message });

  if (opts.isNew && !/^[a-z0-9-]+$/.test(draft.id)) {
    fail("id", "Chỉ gồm a-z, 0-9 và dấu gạch ngang");
  }
  if (draft.code.trim() === "") {
    fail("code", "Mã không được để trống");
  }
  if (!Number.isInteger(draft.maxRedemptions) || draft.maxRedemptions < 1) {
    fail("maxRedemptions", "Số nguyên ≥ 1");
  }
  if (draft.rewards.length === 0) {
    fail("rewards", "Phải có ít nhất một phần thưởng");
  } else {
    const seen = new Set<string>();
    for (const r of draft.rewards) {
      if (!Number.isInteger(r.quantity) || r.quantity < 1) {
        fail("rewards", "Số lượng mỗi đan dược phải là số nguyên ≥ 1");
        break;
      }
      if (seen.has(r.pillId)) {
        fail("rewards", `Pill "${r.pillId}" bị trùng`);
        break;
      }
      seen.add(r.pillId);
    }
  }
  return errors;
}

export function findRedeemError(
  errors: RedeemDraftError[],
  field: string,
): RedeemDraftError | undefined {
  return errors.find((e) => e.field === field);
}
