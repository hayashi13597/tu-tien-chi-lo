// Realm metadata for the 12 realms the backend returns (realmMajor 0-11,
// realmSub 0-3). Kept in sync with backend/src/infrastructure/config/realms.ts
// by name; the visual fields (glyph/color/desc) are frontend-only presentation.
export interface RealmMeta {
  name: string;
  glyph: string; // Hanzi shown in the dantian core
  color: string; // theme color for this realm
  desc: string; // Vietnamese description under the realm name
}

export const REALM_META: RealmMeta[] = [
  {
    name: "Phàm Nhân",
    glyph: "凡",
    color: "#9ca3af",
    desc: "Phàm thai chưa rửa, căn cốt sơ khai",
  },
  {
    name: "Luyện Khí",
    glyph: "气",
    color: "#5dd9b1",
    desc: "Hấp thụ linh khí, cơ thể tinh khiết",
  },
  {
    name: "Trúc Cơ",
    glyph: "基",
    color: "#7dd3fc",
    desc: "Xây dựng nền tảng, thần thức mở rộng",
  },
  {
    name: "Kết Đan",
    glyph: "丹",
    color: "#fbbf24",
    desc: "Kết thành kim đan, thọ nguyên tăng trưởng",
  },
  {
    name: "Nguyên Anh",
    glyph: "婴",
    color: "#a855f7",
    desc: "Nguyên anh xuất khiếu, pháp lực vô biên",
  },
  {
    name: "Hóa Thần",
    glyph: "神",
    color: "#ec4899",
    desc: "Thần thông quảng đại, ý niệm sinh diệt",
  },
  {
    name: "Phá Hư",
    glyph: "虚",
    color: "#06b6d4",
    desc: "Phá hư không, thông hiểu thiên đạo",
  },
  {
    name: "Đại Thừa",
    glyph: "乘",
    color: "#f97316",
    desc: "Đại đạo đắc thành, chờ ngày phi thăng",
  },
  {
    name: "Độ Kiếp",
    glyph: "劫",
    color: "#dc2626",
    desc: "Thiên kiếp giáng lâm, sinh tử nhất thoáng",
  },
  {
    name: "Chân Tiên",
    glyph: "仙",
    color: "#f0abfc",
    desc: "Phi phàm thoát tục, chân tiên chi thể",
  },
  {
    name: "Kim Tiên",
    glyph: "金",
    color: "#fde047",
    desc: "Kim cương bất hoại, vạn kiếp bất diệt",
  },
  {
    name: "Thái Ất",
    glyph: "太",
    color: "#ffffff",
    desc: "Thái Ất hợp đạo, chí cao vô thượng",
  },
];

export const SUB_STAGE_NAMES = [
  "Sơ",
  "Trung",
  "Viên Mãn",
  "Đại Viên Mãn",
] as const;

// Hanzi placed around each ring of the dantian formation (ring index -> chars)
export const RING_CHARS: Record<number, string[]> = {
  1: ["道", "德", "玄", "清"],
  2: ["金", "木", "水", "火", "土", "风", "雷", "电"],
  3: ["天", "地", "人", "阴", "阳", "神", "鬼", "仙", "佛", "魔", "妖", "圣"],
  4: [
    "元",
    "亨",
    "利",
    "贞",
    "乾",
    "坤",
    "震",
    "巽",
    "坎",
    "离",
    "艮",
    "兑",
    "甲",
    "乙",
    "丙",
    "丁",
  ],
};

export function getRealmMeta(realmMajor: number): RealmMeta {
  return REALM_META[realmMajor] ?? REALM_META[0];
}

export function getSubStageName(realmSub: number): string {
  return SUB_STAGE_NAMES[realmSub] ?? SUB_STAGE_NAMES[0];
}
