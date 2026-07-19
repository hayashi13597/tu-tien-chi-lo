import { describe, expect, it } from "vitest";
import { findError, validateRealmDraft } from "./realm-validation";
import type { RealmConfigDTO } from "./types";

function stage(
  overrides: Partial<RealmConfigDTO["subStages"][number]> = {},
): RealmConfigDTO["subStages"][number] {
  return {
    name: "Sơ Kỳ",
    linhKhiRequired: 100,
    cultivationRate: 1,
    baseSuccessRate: 90,
    pityIncrement: 10,
    maxSuccessRate: 95,
    punishmentSeconds: 300,
    ...overrides,
  };
}

describe("validateRealmDraft", () => {
  it("passes a valid multi-realm config with a cross-realm linh khí reset", () => {
    const realms: RealmConfigDTO[] = [
      {
        name: "Phàm Nhân",
        subStages: [
          stage({ linhKhiRequired: 100 }),
          stage({ name: "Viên Mãn", linhKhiRequired: 500 }),
        ],
      },
      // Starts BELOW the previous realm's peak — legal by design.
      { name: "Luyện Khí", subStages: [stage({ linhKhiRequired: 300 })] },
    ];
    expect(validateRealmDraft(realms)).toEqual([]);
  });

  it("rejects an empty config", () => {
    const errors = validateRealmDraft([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].realmIndex).toBe(-1);
  });

  it("rejects a realm with no sub-stages and an empty realm name", () => {
    const errors = validateRealmDraft([{ name: "", subStages: [] }]);
    expect(findError(errors, 0, null, "name")).toBeDefined();
    expect(findError(errors, 0, null, null)).toBeDefined(); // no sub-stages
  });

  it("rejects non-increasing linhKhiRequired within a realm, pinned to the offending stage", () => {
    const realms: RealmConfigDTO[] = [
      {
        name: "Phàm Nhân",
        subStages: [
          stage({ linhKhiRequired: 100 }),
          stage({ name: "Trung Kỳ", linhKhiRequired: 100 }),
        ],
      },
    ];
    const errors = validateRealmDraft(realms);
    expect(findError(errors, 0, 1, "linhKhiRequired")).toBeDefined();
  });

  it("rejects out-of-range numbers and NaN", () => {
    const realms: RealmConfigDTO[] = [
      {
        name: "Phàm Nhân",
        subStages: [
          stage({
            linhKhiRequired: Number.NaN,
            cultivationRate: 0,
            baseSuccessRate: 101,
            maxSuccessRate: -1,
            pityIncrement: -5,
            punishmentSeconds: 3.5,
          }),
        ],
      },
    ];
    const errors = validateRealmDraft(realms);
    expect(findError(errors, 0, 0, "linhKhiRequired")).toBeDefined();
    expect(findError(errors, 0, 0, "cultivationRate")).toBeDefined();
    expect(findError(errors, 0, 0, "baseSuccessRate")).toBeDefined();
    expect(findError(errors, 0, 0, "maxSuccessRate")).toBeDefined();
    expect(findError(errors, 0, 0, "pityIncrement")).toBeDefined();
    expect(findError(errors, 0, 0, "punishmentSeconds")).toBeDefined();
  });

  it("rejects an empty sub-stage name", () => {
    const realms: RealmConfigDTO[] = [
      { name: "Phàm Nhân", subStages: [stage({ name: "  " })] },
    ];
    expect(findError(validateRealmDraft(realms), 0, 0, "name")).toBeDefined();
  });
});
