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
  const fail = (field: string, message: string) =>
    errors.push({ field, message });

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
        fail("rewards", "Số lượng mỗi phần thưởng phải là số nguyên ≥ 1");
        break;
      }
      // Exactly one kind per reward — mirrors the backend's
      // validateRedeemCodeDefinition, which rejects zero or two kinds.
      const kinds = [
        r.pillId !== undefined,
        r.congPhapId !== undefined,
        r.linhThach !== undefined,
      ].filter(Boolean).length;
      if (kinds !== 1) {
        fail("rewards", "Mỗi phần thưởng phải chọn đúng một loại");
        break;
      }
      if (r.pillId !== undefined && r.pillId.trim() === "") {
        fail("rewards", "Chưa chọn đan dược");
        break;
      }
      if (r.congPhapId !== undefined && r.congPhapId.trim() === "") {
        fail("rewards", "Chưa chọn công pháp");
        break;
      }
      if (
        r.linhThach !== undefined &&
        (!Number.isInteger(r.linhThach) || r.linhThach < 1)
      ) {
        fail("rewards", "Linh Thạch phải là số nguyên ≥ 1");
        break;
      }
      // Dedupe key carries the kind: pill "x" and công pháp "x" are different
      // rewards, and only one Linh Thạch entry makes sense per code.
      const key =
        r.pillId !== undefined
          ? `pill:${r.pillId}`
          : r.congPhapId !== undefined
            ? `congphap:${r.congPhapId}`
            : "linhThach";
      if (seen.has(key)) {
        fail("rewards", `Phần thưởng "${key}" bị trùng`);
        break;
      }
      seen.add(key);
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
