import type { AttributeKey } from "./types";

// Display order for the 6 attributes — survivability first, then offence,
// then defence/speed. Mirrors how the backend lists ATTRIBUTE_KEYS so the two
// stay readable side by side.
export const ATTRIBUTE_ORDER: AttributeKey[] = [
  "khiHuyet",
  "chanNguyen",
  "congVatLy",
  "congPhep",
  "phongThu",
  "tocDo",
];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  khiHuyet: "Khí huyết",
  chanNguyen: "Chân nguyên",
  congVatLy: "Công vật lý",
  congPhep: "Công phép",
  phongThu: "Phòng thủ",
  tocDo: "Tốc độ",
};

export function attributeLabel(key: AttributeKey): string {
  return ATTRIBUTE_LABELS[key];
}
