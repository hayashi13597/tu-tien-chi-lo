import { describe, expect, it } from "vitest";
import {
  getRealmMeta,
  getSubStageName,
  REALM_META,
  RING_CHARS,
  SUB_STAGE_NAMES,
} from "./realm-constants";

describe("REALM_META", () => {
  it("has 12 realms", () => {
    expect(REALM_META).toHaveLength(12);
  });
  it("first realm is Phàm Nhân, last is Thái Ất", () => {
    expect(REALM_META[0].name).toBe("Phàm Nhân");
    expect(REALM_META[11].name).toBe("Thái Ất");
  });
});

describe("getRealmMeta", () => {
  it("returns the matching realm", () => {
    expect(getRealmMeta(3).name).toBe("Kết Đan");
  });
  it("falls back to index 0 when out of range", () => {
    expect(getRealmMeta(99).name).toBe("Phàm Nhân");
    expect(getRealmMeta(-1).name).toBe("Phàm Nhân");
  });
});

describe("getSubStageName", () => {
  it("returns the matching sub-stage", () => {
    expect(getSubStageName(2)).toBe("Viên Mãn");
  });
  it("falls back to index 0 when out of range", () => {
    expect(getSubStageName(99)).toBe(SUB_STAGE_NAMES[0]);
  });
});

describe("RING_CHARS", () => {
  it("defines rings 1 through 4", () => {
    expect(RING_CHARS[1]).toHaveLength(4);
    expect(RING_CHARS[4].length).toBeGreaterThan(0);
  });
});
