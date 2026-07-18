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
  subStages: [SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig];
}

export const REALMS: RealmConfig[] = [
  {
    name: 'Phàm Nhân',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 100, cultivationRate: 1.00, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      { name: 'Trung', linhKhiRequired: 200, cultivationRate: 1.15, baseSuccessRate: 87, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 600 },
      { name: 'Viên Mãn', linhKhiRequired: 350, cultivationRate: 1.30, baseSuccessRate: 84, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 500, cultivationRate: 1.45, baseSuccessRate: 81, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 1200 },
    ],
  },
  {
    name: 'Luyện Khí',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 300, cultivationRate: 1.60, baseSuccessRate: 84, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1500 },
      { name: 'Trung', linhKhiRequired: 600, cultivationRate: 1.84, baseSuccessRate: 81, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1800 },
      { name: 'Viên Mãn', linhKhiRequired: 1050, cultivationRate: 2.08, baseSuccessRate: 78, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 1500, cultivationRate: 2.32, baseSuccessRate: 75, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2400 },
    ],
  },
  {
    name: 'Trúc Cơ',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 900, cultivationRate: 2.56, baseSuccessRate: 78, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 2700 },
      { name: 'Trung', linhKhiRequired: 1800, cultivationRate: 2.94, baseSuccessRate: 75, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3000 },
      { name: 'Viên Mãn', linhKhiRequired: 3150, cultivationRate: 3.33, baseSuccessRate: 72, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3300 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 4500, cultivationRate: 3.71, baseSuccessRate: 69, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3600 },
    ],
  },
  {
    name: 'Kết Đan',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 2700, cultivationRate: 4.10, baseSuccessRate: 72, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 3900 },
      { name: 'Trung', linhKhiRequired: 5400, cultivationRate: 4.71, baseSuccessRate: 69, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4200 },
      { name: 'Viên Mãn', linhKhiRequired: 9450, cultivationRate: 5.32, baseSuccessRate: 66, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4500 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 13500, cultivationRate: 5.94, baseSuccessRate: 63, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4800 },
    ],
  },
  {
    name: 'Nguyên Anh',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 8100, cultivationRate: 6.55, baseSuccessRate: 66, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5100 },
      { name: 'Trung', linhKhiRequired: 16200, cultivationRate: 7.54, baseSuccessRate: 63, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5400 },
      { name: 'Viên Mãn', linhKhiRequired: 28350, cultivationRate: 8.52, baseSuccessRate: 60, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5700 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 40500, cultivationRate: 9.50, baseSuccessRate: 57, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 6000 },
    ],
  },
  {
    name: 'Hóa Thần',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 24300, cultivationRate: 10.49, baseSuccessRate: 60, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6300 },
      { name: 'Trung', linhKhiRequired: 48600, cultivationRate: 12.06, baseSuccessRate: 57, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6600 },
      { name: 'Viên Mãn', linhKhiRequired: 85050, cultivationRate: 13.63, baseSuccessRate: 54, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 121500, cultivationRate: 15.20, baseSuccessRate: 51, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 7200 },
    ],
  },
  {
    name: 'Phá Hư',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 72900, cultivationRate: 16.78, baseSuccessRate: 54, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7500 },
      { name: 'Trung', linhKhiRequired: 145800, cultivationRate: 19.29, baseSuccessRate: 51, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7800 },
      { name: 'Viên Mãn', linhKhiRequired: 255150, cultivationRate: 21.81, baseSuccessRate: 48, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 364500, cultivationRate: 24.33, baseSuccessRate: 45, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8400 },
    ],
  },
  {
    name: 'Đại Thừa',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 218700, cultivationRate: 26.84, baseSuccessRate: 48, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 8700 },
      { name: 'Trung', linhKhiRequired: 437400, cultivationRate: 30.87, baseSuccessRate: 45, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9000 },
      { name: 'Viên Mãn', linhKhiRequired: 765450, cultivationRate: 34.90, baseSuccessRate: 42, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9300 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 1093500, cultivationRate: 38.92, baseSuccessRate: 39, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9600 },
    ],
  },
  {
    name: 'Độ Kiếp',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 656100, cultivationRate: 42.95, baseSuccessRate: 42, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 9900 },
      { name: 'Trung', linhKhiRequired: 1312200, cultivationRate: 49.39, baseSuccessRate: 39, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10200 },
      { name: 'Viên Mãn', linhKhiRequired: 2296350, cultivationRate: 55.83, baseSuccessRate: 36, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10500 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 3280500, cultivationRate: 62.28, baseSuccessRate: 33, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10800 },
    ],
  },
  {
    name: 'Chân Tiên',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 1968300, cultivationRate: 68.72, baseSuccessRate: 36, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11100 },
      { name: 'Trung', linhKhiRequired: 3936600, cultivationRate: 79.03, baseSuccessRate: 33, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11400 },
      { name: 'Viên Mãn', linhKhiRequired: 6889050, cultivationRate: 89.34, baseSuccessRate: 30, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11700 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 9841500, cultivationRate: 99.64, baseSuccessRate: 27, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 12000 },
    ],
  },
  {
    name: 'Kim Tiên',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 5904900, cultivationRate: 109.95, baseSuccessRate: 30, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12300 },
      { name: 'Trung', linhKhiRequired: 11809800, cultivationRate: 126.44, baseSuccessRate: 27, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12600 },
      { name: 'Viên Mãn', linhKhiRequired: 20667150, cultivationRate: 142.94, baseSuccessRate: 24, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 29524500, cultivationRate: 159.43, baseSuccessRate: 21, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 13200 },
    ],
  },
  {
    name: 'Thái Ất',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 17714700, cultivationRate: 175.92, baseSuccessRate: 24, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13500 },
      { name: 'Trung', linhKhiRequired: 35429400, cultivationRate: 202.31, baseSuccessRate: 21, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13800 },
      { name: 'Viên Mãn', linhKhiRequired: 62001450, cultivationRate: 228.70, baseSuccessRate: 18, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 88573500, cultivationRate: 255.09, baseSuccessRate: 15, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14400 },
    ],
  },
];

export const MAX_REALM_MAJOR = REALMS.length - 1;
