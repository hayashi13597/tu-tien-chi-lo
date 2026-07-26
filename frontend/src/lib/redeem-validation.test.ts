import { describe, expect, it } from "vitest";
import { findRedeemError, validateRedeemDraft } from "./redeem-validation";
import type { AdminRedeemCodeDTO } from "./types";

function draft(over: Partial<AdminRedeemCodeDTO> = {}): AdminRedeemCodeDTO {
  return {
    id: "abc-code",
    code: "TEST2026",
    active: true,
    maxRedemptions: 5,
    redeemedCount: 0,
    expiresAt: null,
    rewards: [{ pillId: "p1", quantity: 2 }],
    ...over,
  };
}

describe("validateRedeemDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateRedeemDraft(draft(), { isNew: true })).toHaveLength(0);
  });
  it("rejects a non-slug id on create", () => {
    const errors = validateRedeemDraft(draft({ id: "Bad ID" }), {
      isNew: true,
    });
    expect(findRedeemError(errors, "id")).toBeDefined();
  });
  it("skips id validation on edit", () => {
    const errors = validateRedeemDraft(draft({ id: "Bad ID" }), {
      isNew: false,
    });
    expect(findRedeemError(errors, "id")).toBeUndefined();
  });
  it("rejects empty code", () => {
    const errors = validateRedeemDraft(draft({ code: "  " }), { isNew: true });
    expect(findRedeemError(errors, "code")).toBeDefined();
  });
  it("rejects maxRedemptions < 1", () => {
    const errors = validateRedeemDraft(draft({ maxRedemptions: 0 }), {
      isNew: true,
    });
    expect(findRedeemError(errors, "maxRedemptions")).toBeDefined();
  });
  it("rejects NaN maxRedemptions (from empty input)", () => {
    const errors = validateRedeemDraft(draft({ maxRedemptions: NaN }), {
      isNew: true,
    });
    expect(findRedeemError(errors, "maxRedemptions")).toBeDefined();
  });
  it("rejects empty rewards", () => {
    const errors = validateRedeemDraft(draft({ rewards: [] }), { isNew: true });
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });
  it("rejects reward quantity < 1", () => {
    const errors = validateRedeemDraft(
      draft({ rewards: [{ pillId: "p1", quantity: 0 }] }),
      { isNew: true },
    );
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });
  it("rejects duplicate pillId in rewards", () => {
    const errors = validateRedeemDraft(
      draft({
        rewards: [
          { pillId: "p1", quantity: 1 },
          { pillId: "p1", quantity: 2 },
        ],
      }),
      { isNew: true },
    );
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });

  it("accepts công pháp and Linh Thạch rewards", () => {
    const errors = validateRedeemDraft(
      draft({
        rewards: [
          { congPhapId: "thiet-cot-quyet", quantity: 1 },
          { linhThach: 500, quantity: 1 },
        ],
      }),
      { isNew: true },
    );
    expect(errors).toHaveLength(0);
  });

  it("rejects a reward with no kind, or with two kinds", () => {
    expect(
      findRedeemError(
        validateRedeemDraft(draft({ rewards: [{ quantity: 1 }] }), {
          isNew: true,
        }),
        "rewards",
      ),
    ).toBeDefined();
    expect(
      findRedeemError(
        validateRedeemDraft(
          draft({
            rewards: [{ pillId: "p1", congPhapId: "cp1", quantity: 1 }],
          }),
          { isNew: true },
        ),
        "rewards",
      ),
    ).toBeDefined();
  });

  it("rejects a Linh Thạch amount below 1", () => {
    expect(
      findRedeemError(
        validateRedeemDraft(
          draft({ rewards: [{ linhThach: 0, quantity: 1 }] }),
          {
            isNew: true,
          },
        ),
        "rewards",
      ),
    ).toBeDefined();
  });

  it("allows the same id across different reward kinds", () => {
    const errors = validateRedeemDraft(
      draft({
        rewards: [
          { pillId: "x", quantity: 1 },
          { congPhapId: "x", quantity: 1 },
        ],
      }),
      { isNew: true },
    );
    expect(errors).toHaveLength(0);
  });
});
