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
