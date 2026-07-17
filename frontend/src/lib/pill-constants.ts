import type { InventoryPill, PillDef, PillRarity } from "./types";

// Rarity presentation, mirroring how realm-constants.ts holds realm visuals.
// Colors reuse globals.css tokens where one exists; tier 2 has no token so a
// literal lam matches the realm palette's "Trúc Cơ" blue.
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

// Mock catalog: spans all 4 effect kinds and all 5 rarities.
export const PILL_DEFS: PillDef[] = [
  {
    id: "hoi-khi-dan",
    name: "Hồi Khí Đan",
    glyph: "气",
    rarity: 0,
    effect: { kind: "linhKhi", amount: 50 },
    desc: "Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.",
  },
  {
    id: "tu-linh-dan",
    name: "Tụ Linh Đan",
    glyph: "聚",
    rarity: 2,
    effect: { kind: "linhKhi", amount: 300 },
    desc: "Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.",
  },
  {
    id: "cuu-chuyen-kim-dan",
    name: "Cửu Chuyển Kim Đan",
    glyph: "金",
    rarity: 4,
    effect: { kind: "linhKhi", amount: 2000 },
    desc: "Thánh dược cửu chuyển, cộng ngay 2000 linh khí.",
  },
  {
    id: "tinh-tam-dan",
    name: "Tịnh Tâm Đan",
    glyph: "静",
    rarity: 1,
    effect: { kind: "cultivationBuff", multiplier: 1.5, durationSec: 120 },
    desc: "Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.",
  },
  {
    id: "ngung-than-dan",
    name: "Ngưng Thần Đan",
    glyph: "凝",
    rarity: 3,
    effect: { kind: "cultivationBuff", multiplier: 2, durationSec: 180 },
    desc: "Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.",
  },
  {
    id: "pha-canh-dan",
    name: "Phá Cảnh Đan",
    glyph: "破",
    rarity: 2,
    effect: { kind: "breakthroughBoost", bonusPct: 15 },
    desc: "Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.",
  },
  {
    id: "thien-cang-dan",
    name: "Thiên Cang Đan",
    glyph: "罡",
    rarity: 4,
    effect: { kind: "breakthroughBoost", bonusPct: 40 },
    desc: "Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.",
  },
  {
    id: "giai-phat-dan",
    name: "Giải Phạt Đan",
    glyph: "解",
    rarity: 3,
    effect: { kind: "clearPunishment" },
    desc: "Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.",
  },
];

// Seed inventory: a subset the player "already owns", with quantities.
export const SEED_INVENTORY: InventoryPill[] = [
  { def: PILL_DEFS[0], quantity: 5 },
  { def: PILL_DEFS[1], quantity: 3 },
  { def: PILL_DEFS[2], quantity: 1 },
  { def: PILL_DEFS[3], quantity: 2 },
  { def: PILL_DEFS[4], quantity: 1 },
  { def: PILL_DEFS[5], quantity: 2 },
  { def: PILL_DEFS[6], quantity: 1 },
  { def: PILL_DEFS[7], quantity: 2 },
];
