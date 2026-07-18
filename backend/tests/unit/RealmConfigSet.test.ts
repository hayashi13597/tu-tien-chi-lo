import { describe, it, expect } from 'vitest';
import {
  realmConfigSetFromRows,
  flattenRealms,
  defaultRealmConfigSet,
  SEED_REALMS,
  SubStageRow,
} from '../../src/domain/config/realms';

const ROWS: SubStageRow[] = [
  { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
  { realmMajor: 0, realmSub: 1, realmName: 'A', subStageName: 'A1', linhKhiRequired: 200, cultivationRate: 1.2, baseSuccessRate: 88, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 400 },
  { realmMajor: 1, realmSub: 0, realmName: 'B', subStageName: 'B0', linhKhiRequired: 300, cultivationRate: 1.5, baseSuccessRate: 84, pityIncrement: 9, maxSuccessRate: 95, punishmentSeconds: 500 },
];

describe('RealmConfigSet', () => {
  it('builds nested realms from flat rows and reads a stage', () => {
    const set = realmConfigSetFromRows(ROWS);
    expect(set.maxRealmMajor).toBe(1);
    expect(set.peakRealmSub(0)).toBe(1);
    expect(set.peakRealmSub(1)).toBe(0);
    expect(set.realmName(1)).toBe('B');
    expect(set.getStage(0, 1).name).toBe('A1');
    expect(set.getStage(0, 1).linhKhiRequired).toBe(200);
  });

  it('clampStage clamps an over-range major then sub to the nearest valid stage', () => {
    const set = realmConfigSetFromRows(ROWS);
    expect(set.clampStage(0, 0)).toEqual({ realmMajor: 0, realmSub: 0 }); // in range, no-op
    expect(set.clampStage(0, 9)).toEqual({ realmMajor: 0, realmSub: 1 }); // sub over range
    expect(set.clampStage(5, 3)).toEqual({ realmMajor: 1, realmSub: 0 }); // major over range → clamp sub to that realm's peak
    expect(set.clampStage(-2, -5)).toEqual({ realmMajor: 0, realmSub: 0 }); // below range
  });

  it('flattenRealms is the inverse of realmConfigSetFromRows for realm/sub indices', () => {
    const rows = flattenRealms(realmConfigSetFromRows(ROWS).toRealms());
    expect(rows.map((r) => [r.realmMajor, r.realmSub, r.subStageName])).toEqual([
      [0, 0, 'A0'], [0, 1, 'A1'], [1, 0, 'B0'],
    ]);
  });

  it('defaultRealmConfigSet exposes 12 realms of 5 sub-stages from SEED_REALMS', () => {
    const set = defaultRealmConfigSet();
    expect(SEED_REALMS.length).toBe(12);
    expect(set.maxRealmMajor).toBe(11);
    expect(set.peakRealmSub(0)).toBe(4);
    expect(set.getStage(0, 0).linhKhiRequired).toBe(100); // unchanged from today's balance
  });
});
