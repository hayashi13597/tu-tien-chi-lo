import type { PillRarity } from "./types";

// Rarity presentation, mirroring how realm-constants.ts holds realm visuals.
// Colors reuse globals.css tokens where one exists; tier 2 has no token so a
// literal lam matches the realm palette's "Trúc Cơ" blue.
// The pill catalog itself lives in the backend DB (GET /pills/inventory) —
// only this presentation mapping stays client-side.
export const RARITY_META: Record<PillRarity, { name: string; color: string }> =
  {
    0: { name: "Phàm phẩm", color: "var(--muted)" },
    1: { name: "Hạ phẩm", color: "var(--jade)" },
    2: { name: "Trung phẩm", color: "#7dd3fc" },
    3: { name: "Thượng phẩm", color: "var(--purple)" },
    4: { name: "Tuyệt phẩm", color: "var(--gold)" },
  };

export function getRarityMeta(rarity: PillRarity) {
  return RARITY_META[rarity];
}

/** Số ô của gauge độ hiếm — một ô cho mỗi bậc. */
export const RARITY_PIPS = 5;

/**
 * Số pip sáng cho một bậc độ hiếm: bậc 0 sáng 1, bậc 4 sáng đủ 5.
 * `CongPhap.rarity` phía backend là `Int` không chặn khoảng (khác `Pill`), nên
 * kẹp trước khi đếm — cùng lý do `getCongPhapRarityMeta` phải kẹp trước khi tra
 * `RARITY_META`.
 */
export function rarityPipCount(rarity: number): number {
  return Math.min(Math.max(Math.floor(rarity), 0), 4) + 1;
}
