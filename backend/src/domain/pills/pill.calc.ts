import { PillRecord } from './pill';

export interface PillEffectResult {
  linhKhi: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
  punishedUntil: Date | null;
}

// Pure translation of "consume this pill" into the character field changes to
// persist. One source of truth shared by ConsumePillUseCase and its tests.
// Starts from the character's current values and mutates only the effect's field.
export function applyPillEffect(input: {
  currentLinhKhi: number;
  character: {
    cultivationBuffMultiplier: number | null;
    cultivationBuffUntil: Date | null;
    breakthroughBonusPct: number;
    punishedUntil: Date | null;
  };
  pill: PillRecord;
  now: Date;
}): PillEffectResult {
  const { character: c, pill, now } = input;
  const result: PillEffectResult = {
    linhKhi: input.currentLinhKhi,
    cultivationBuffMultiplier: c.cultivationBuffMultiplier,
    cultivationBuffUntil: c.cultivationBuffUntil,
    breakthroughBonusPct: c.breakthroughBonusPct,
    punishedUntil: c.punishedUntil,
  };

  switch (pill.effectKind) {
    case 'linhKhi':
      result.linhKhi = input.currentLinhKhi + (pill.amount ?? 0);
      break;
    case 'cultivationBuff':
      // Refresh (one buff at a time): replace multiplier + reset expiry from now.
      result.cultivationBuffMultiplier = pill.multiplier ?? null;
      result.cultivationBuffUntil = new Date(now.getTime() + (pill.durationSec ?? 0) * 1000);
      break;
    case 'breakthroughBoost':
      // Replace, not add — a fresh boost overrides any stale pending one.
      result.breakthroughBonusPct = pill.bonusPct ?? 0;
      break;
    case 'clearPunishment':
      result.punishedUntil = null;
      break;
  }
  return result;
}
