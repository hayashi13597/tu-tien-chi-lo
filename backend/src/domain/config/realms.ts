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
  // One or more sub-stages, ordered Sơ Kỳ → … → Viên Mãn. The count is no longer
  // fixed at 5: admins may add/remove sub-stages, so consumers must read the
  // length via RealmConfigSet.peakRealmSub instead of assuming an index.
  subStages: SubStageConfig[];
}

// Flat DB-row shape: one row per sub-stage, the storage form of the config.
export interface SubStageRow {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  subStageName: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

// SEED_REALMS is the original hard-coded balance, kept only as the seed source
// of truth and a reference. Runtime reads the config from the DB (RealmStage);
// this literal is upserted by prisma/seed.ts.
export const SEED_REALMS: RealmConfig[] = [
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

// Immutable view over the realm config with the pure helpers the use cases need.
// Replaces the old REALMS[..] indexing + MAX_REALM_* constants so the sub-stage
// count and realm count come from the data, not magic numbers.
export class RealmConfigSet {
  constructor(private readonly realms: RealmConfig[]) {}

  getStage(realmMajor: number, realmSub: number): SubStageConfig {
    return this.realms[realmMajor].subStages[realmSub];
  }

  realmName(realmMajor: number): string {
    return this.realms[realmMajor].name;
  }

  get maxRealmMajor(): number {
    return this.realms.length - 1;
  }

  peakRealmSub(realmMajor: number): number {
    return this.realms[realmMajor].subStages.length - 1;
  }

  // Nearest valid (major, sub) for a possibly out-of-range character — e.g. after
  // an admin removes a realm/sub-stage under someone standing on it. Clamp major
  // into [0, maxRealmMajor] first, then sub into [0, peakRealmSub(clampedMajor)],
  // because the valid sub range depends on which realm we landed in.
  clampStage(realmMajor: number, realmSub: number): { realmMajor: number; realmSub: number } {
    const major = Math.min(Math.max(realmMajor, 0), this.maxRealmMajor);
    const sub = Math.min(Math.max(realmSub, 0), this.peakRealmSub(major));
    return { realmMajor: major, realmSub: sub };
  }

  toRealms(): RealmConfig[] {
    return this.realms;
  }
}

// Group ordered flat rows back into the nested realm structure.
export function realmConfigSetFromRows(rows: SubStageRow[]): RealmConfigSet {
  const sorted = [...rows].sort((a, b) =>
    a.realmMajor - b.realmMajor || a.realmSub - b.realmSub,
  );
  const realms: RealmConfig[] = [];
  for (const r of sorted) {
    if (!realms[r.realmMajor]) {
      realms[r.realmMajor] = { name: r.realmName, subStages: [] };
    }
    realms[r.realmMajor].subStages[r.realmSub] = {
      name: r.subStageName,
      linhKhiRequired: r.linhKhiRequired,
      cultivationRate: r.cultivationRate,
      baseSuccessRate: r.baseSuccessRate,
      pityIncrement: r.pityIncrement,
      maxSuccessRate: r.maxSuccessRate,
      punishmentSeconds: r.punishmentSeconds,
    };
  }
  return new RealmConfigSet(realms);
}

// Nested → flat rows, assigning realmMajor/realmSub from array positions.
export function flattenRealms(realms: RealmConfig[]): SubStageRow[] {
  const rows: SubStageRow[] = [];
  realms.forEach((realm, realmMajor) => {
    realm.subStages.forEach((s, realmSub) => {
      rows.push({
        realmMajor,
        realmSub,
        realmName: realm.name,
        subStageName: s.name,
        linhKhiRequired: s.linhKhiRequired,
        cultivationRate: s.cultivationRate,
        baseSuccessRate: s.baseSuccessRate,
        pityIncrement: s.pityIncrement,
        maxSuccessRate: s.maxSuccessRate,
        punishmentSeconds: s.punishmentSeconds,
      });
    });
  });
  return rows;
}

export function defaultRealmConfigSet(): RealmConfigSet {
  return new RealmConfigSet(SEED_REALMS);
}
