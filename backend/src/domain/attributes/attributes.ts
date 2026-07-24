// 6 thuộc tính cơ bản của nhân vật. Khóa dùng nguyên văn xuyên suốt hệ thống.
export interface AttributeSet {
  khiHuyet: number;   // HP
  chanNguyen: number; // MP
  congVatLy: number;  // công vật lý
  congPhep: number;   // công phép
  phongThu: number;   // phòng thủ
  tocDo: number;      // tốc độ
}

export const ATTRIBUTE_KEYS: (keyof AttributeSet)[] = [
  'khiHuyet', 'chanNguyen', 'congVatLy', 'congPhep', 'phongThu', 'tocDo',
];

// Trọng số quy đổi 6 thuộc tính → Chiến lực. Công/tốc độ nặng hơn HP/MP vì HP/MP
// vốn có giá trị tuyệt đối lớn hơn nhiều. Số khởi tạo — cân bằng, không phải chân lý.
export const BATTLE_POWER_WEIGHTS: AttributeSet = {
  khiHuyet: 0.1, chanNguyen: 0.1, congVatLy: 1, congPhep: 1, phongThu: 0.8, tocDo: 1.2,
};
