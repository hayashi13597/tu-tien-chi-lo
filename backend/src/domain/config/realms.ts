export interface SubStageConfig {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

export interface RealmConfig {
  name: string;
  // Five sub-stages per realm: Sơ Kỳ → Trung Kỳ → Hậu Kỳ → Đại Thành → Viên Mãn.
  subStages: [SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig];
}

export const REALMS: RealmConfig[] = [
  {
    name: 'Phàm Nhân',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 100, cultivationRate: 1.00, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      { name: 'Trung Kỳ', linhKhiRequired: 175, cultivationRate: 1.11, baseSuccessRate: 87.8, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 525 },
      { name: 'Hậu Kỳ', linhKhiRequired: 275, cultivationRate: 1.23, baseSuccessRate: 85.5, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 750 },
      { name: 'Đại Thành', linhKhiRequired: 388, cultivationRate: 1.34, baseSuccessRate: 83.3, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 975 },
      { name: 'Viên Mãn', linhKhiRequired: 500, cultivationRate: 1.45, baseSuccessRate: 81, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 1200 },
    ],
  },
  {
    name: 'Luyện Khí',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 300, cultivationRate: 1.60, baseSuccessRate: 84, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1500 },
      { name: 'Trung Kỳ', linhKhiRequired: 525, cultivationRate: 1.78, baseSuccessRate: 81.8, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1725 },
      { name: 'Hậu Kỳ', linhKhiRequired: 825, cultivationRate: 1.96, baseSuccessRate: 79.5, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1950 },
      { name: 'Đại Thành', linhKhiRequired: 1163, cultivationRate: 2.14, baseSuccessRate: 77.3, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2175 },
      { name: 'Viên Mãn', linhKhiRequired: 1500, cultivationRate: 2.32, baseSuccessRate: 75, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2400 },
    ],
  },
  {
    name: 'Trúc Cơ',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 900, cultivationRate: 2.56, baseSuccessRate: 78, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 2700 },
      { name: 'Trung Kỳ', linhKhiRequired: 1575, cultivationRate: 2.84, baseSuccessRate: 75.8, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 2925 },
      { name: 'Hậu Kỳ', linhKhiRequired: 2475, cultivationRate: 3.13, baseSuccessRate: 73.5, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3150 },
      { name: 'Đại Thành', linhKhiRequired: 3488, cultivationRate: 3.42, baseSuccessRate: 71.3, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3375 },
      { name: 'Viên Mãn', linhKhiRequired: 4500, cultivationRate: 3.71, baseSuccessRate: 69, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3600 },
    ],
  },
  {
    name: 'Kết Đan',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 2700, cultivationRate: 4.10, baseSuccessRate: 72, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 3900 },
      { name: 'Trung Kỳ', linhKhiRequired: 4725, cultivationRate: 4.56, baseSuccessRate: 69.8, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4125 },
      { name: 'Hậu Kỳ', linhKhiRequired: 7425, cultivationRate: 5.02, baseSuccessRate: 67.5, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4350 },
      { name: 'Đại Thành', linhKhiRequired: 10463, cultivationRate: 5.48, baseSuccessRate: 65.3, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4575 },
      { name: 'Viên Mãn', linhKhiRequired: 13500, cultivationRate: 5.94, baseSuccessRate: 63, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4800 },
    ],
  },
  {
    name: 'Nguyên Anh',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 8100, cultivationRate: 6.55, baseSuccessRate: 66, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5100 },
      { name: 'Trung Kỳ', linhKhiRequired: 14175, cultivationRate: 7.29, baseSuccessRate: 63.8, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5325 },
      { name: 'Hậu Kỳ', linhKhiRequired: 22275, cultivationRate: 8.03, baseSuccessRate: 61.5, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5550 },
      { name: 'Đại Thành', linhKhiRequired: 31388, cultivationRate: 8.77, baseSuccessRate: 59.3, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5775 },
      { name: 'Viên Mãn', linhKhiRequired: 40500, cultivationRate: 9.50, baseSuccessRate: 57, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 6000 },
    ],
  },
  {
    name: 'Hóa Thần',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 24300, cultivationRate: 10.49, baseSuccessRate: 60, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6300 },
      { name: 'Trung Kỳ', linhKhiRequired: 42525, cultivationRate: 11.67, baseSuccessRate: 57.8, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6525 },
      { name: 'Hậu Kỳ', linhKhiRequired: 66825, cultivationRate: 12.85, baseSuccessRate: 55.5, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6750 },
      { name: 'Đại Thành', linhKhiRequired: 94163, cultivationRate: 14.02, baseSuccessRate: 53.3, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6975 },
      { name: 'Viên Mãn', linhKhiRequired: 121500, cultivationRate: 15.20, baseSuccessRate: 51, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 7200 },
    ],
  },
  {
    name: 'Phá Hư',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 72900, cultivationRate: 16.78, baseSuccessRate: 54, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7500 },
      { name: 'Trung Kỳ', linhKhiRequired: 127575, cultivationRate: 18.66, baseSuccessRate: 51.8, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7725 },
      { name: 'Hậu Kỳ', linhKhiRequired: 200475, cultivationRate: 20.55, baseSuccessRate: 49.5, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7950 },
      { name: 'Đại Thành', linhKhiRequired: 282488, cultivationRate: 22.44, baseSuccessRate: 47.3, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8175 },
      { name: 'Viên Mãn', linhKhiRequired: 364500, cultivationRate: 24.33, baseSuccessRate: 45, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8400 },
    ],
  },
  {
    name: 'Đại Thừa',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 218700, cultivationRate: 26.84, baseSuccessRate: 48, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 8700 },
      { name: 'Trung Kỳ', linhKhiRequired: 382725, cultivationRate: 29.86, baseSuccessRate: 45.8, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 8925 },
      { name: 'Hậu Kỳ', linhKhiRequired: 601425, cultivationRate: 32.88, baseSuccessRate: 43.5, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9150 },
      { name: 'Đại Thành', linhKhiRequired: 847463, cultivationRate: 35.91, baseSuccessRate: 41.3, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9375 },
      { name: 'Viên Mãn', linhKhiRequired: 1093500, cultivationRate: 38.92, baseSuccessRate: 39, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9600 },
    ],
  },
  {
    name: 'Độ Kiếp',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 656100, cultivationRate: 42.95, baseSuccessRate: 42, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 9900 },
      { name: 'Trung Kỳ', linhKhiRequired: 1148175, cultivationRate: 47.78, baseSuccessRate: 39.8, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10125 },
      { name: 'Hậu Kỳ', linhKhiRequired: 1804275, cultivationRate: 52.61, baseSuccessRate: 37.5, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10350 },
      { name: 'Đại Thành', linhKhiRequired: 2542388, cultivationRate: 57.44, baseSuccessRate: 35.3, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10575 },
      { name: 'Viên Mãn', linhKhiRequired: 3280500, cultivationRate: 62.28, baseSuccessRate: 33, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10800 },
    ],
  },
  {
    name: 'Chân Tiên',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 1968300, cultivationRate: 68.72, baseSuccessRate: 36, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11100 },
      { name: 'Trung Kỳ', linhKhiRequired: 3444525, cultivationRate: 76.45, baseSuccessRate: 33.8, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11325 },
      { name: 'Hậu Kỳ', linhKhiRequired: 5412825, cultivationRate: 84.19, baseSuccessRate: 31.5, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11550 },
      { name: 'Đại Thành', linhKhiRequired: 7627163, cultivationRate: 91.92, baseSuccessRate: 29.3, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11775 },
      { name: 'Viên Mãn', linhKhiRequired: 9841500, cultivationRate: 99.64, baseSuccessRate: 27, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 12000 },
    ],
  },
  {
    name: 'Kim Tiên',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 5904900, cultivationRate: 109.95, baseSuccessRate: 30, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12300 },
      { name: 'Trung Kỳ', linhKhiRequired: 10333575, cultivationRate: 122.32, baseSuccessRate: 27.8, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12525 },
      { name: 'Hậu Kỳ', linhKhiRequired: 16238475, cultivationRate: 134.69, baseSuccessRate: 25.5, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12750 },
      { name: 'Đại Thành', linhKhiRequired: 22881488, cultivationRate: 147.06, baseSuccessRate: 23.3, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12975 },
      { name: 'Viên Mãn', linhKhiRequired: 29524500, cultivationRate: 159.43, baseSuccessRate: 21, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 13200 },
    ],
  },
  {
    name: 'Thái Ất',
    subStages: [
      { name: 'Sơ Kỳ', linhKhiRequired: 17714700, cultivationRate: 175.92, baseSuccessRate: 24, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13500 },
      { name: 'Trung Kỳ', linhKhiRequired: 31000725, cultivationRate: 195.71, baseSuccessRate: 21.8, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13725 },
      { name: 'Hậu Kỳ', linhKhiRequired: 48715425, cultivationRate: 215.50, baseSuccessRate: 19.5, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13950 },
      { name: 'Đại Thành', linhKhiRequired: 68644463, cultivationRate: 235.30, baseSuccessRate: 17.3, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14175 },
      { name: 'Viên Mãn', linhKhiRequired: 88573500, cultivationRate: 255.09, baseSuccessRate: 15, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14400 },
    ],
  },
];

export const MAX_REALM_MAJOR = REALMS.length - 1;

// The peak (final) sub-stage index within each realm — a breakthrough from here
// rolls over into the next realm major. Derived from the sub-stage count so the
// magic number stays in one place if the sub-stage layout ever changes again.
export const MAX_REALM_SUB = REALMS[0].subStages.length - 1;
