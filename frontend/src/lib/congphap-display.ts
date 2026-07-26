import { RARITY_META } from "./pill-constants";
import type {
  AttributeKey,
  AttributeSet,
  CongPhapDTO,
  PillRarity,
} from "./types";

// Pure display-side mirrors of the backend's công pháp maths
// (domain/congphap/congphap.calc.ts + attributes.calc.ts). The server stays
// authoritative — these exist so a card can show the next level's cost and a
// công pháp's own contribution without waiting for a round-trip.

/**
 * Linh Thạch to go from `currentLevel` → `currentLevel + 1`. Levels start at 1,
 * so 1→2 costs exactly `baseCost`. Mirrors backend `levelUpCost`.
 */
export function levelUpCost(def: CongPhapDTO, currentLevel: number): number {
  return Math.round(def.baseCost * def.costGrowth ** (currentLevel - 1));
}

/**
 * What this one passive công pháp contributes at `level`, per attribute.
 * Flat and percent are kept apart because the backend applies all flats first
 * and only then the summed percentages — presenting them combined here would
 * imply a per-công-pháp multiplication that never happens.
 */
export function passiveBonusAt(
  def: CongPhapDTO,
  level: number,
): Partial<Record<AttributeKey, { flat: number; pct: number }>> {
  if (def.category !== "passive" || !def.effects) return {};
  const bonus: Partial<Record<AttributeKey, { flat: number; pct: number }>> = {};
  for (const e of def.effects) {
    const current = bonus[e.attribute] ?? { flat: 0, pct: 0 };
    bonus[e.attribute] = {
      flat: current.flat + e.flatPerLevel * level,
      pct: current.pct + e.pctPerLevel * level,
    };
  }
  return bonus;
}

/** Active-only skill power (stored and displayed; combat applies it later). */
export function skillPowerAt(def: CongPhapDTO, level: number): number | null {
  if (def.category !== "active" || def.powerPerLevel === null) return null;
  return def.powerPerLevel * level;
}

/**
 * Rarity presentation for a công pháp. Unlike pills, the backend types rarity
 * as a plain Int with no 0–4 bound, so an admin can save 7 or -1 — clamp
 * before indexing RARITY_META rather than handing the UI an undefined.
 */
export function getCongPhapRarityMeta(rarity: number): {
  name: string;
  color: string;
} {
  const clamped = Math.min(Math.max(Math.floor(rarity), 0), 4) as PillRarity;
  return RARITY_META[clamped];
}

/** Per-attribute gain from passive công pháp: final − base. */
export function attributeDelta(
  base: AttributeSet,
  final: AttributeSet,
): AttributeSet {
  return {
    khiHuyet: final.khiHuyet - base.khiHuyet,
    chanNguyen: final.chanNguyen - base.chanNguyen,
    congVatLy: final.congVatLy - base.congVatLy,
    congPhep: final.congPhep - base.congPhep,
    phongThu: final.phongThu - base.phongThu,
    tocDo: final.tocDo - base.tocDo,
  };
}
