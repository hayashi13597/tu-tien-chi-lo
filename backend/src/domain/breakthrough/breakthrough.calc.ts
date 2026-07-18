// Pity formula: each consecutive failure at the current substage raises the
// next attempt's success rate, capped at maxSuccessRate, so a run of bad luck
// is self-correcting instead of indefinitely punishing.
export function computeSuccessRate(params: {
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  breakthroughFails: number;
  // One-shot bonus (percentage points) from a consumed breakthroughBoost pill.
  // Added into the raw rate so it can push toward — but never past — the cap.
  bonusPct?: number;
}): number {
  const raw =
    params.baseSuccessRate +
    params.breakthroughFails * params.pityIncrement +
    (params.bonusPct ?? 0);
  return Math.min(raw, params.maxSuccessRate);
}

// randomValue is injected (not Math.random() called here) so this function
// stays pure and the caller controls determinism in tests.
export function rollSuccess(successRatePercent: number, randomValue: number): boolean {
  return randomValue * 100 < successRatePercent;
}

// A breakthrough always advances exactly one substage; crossing the peak
// substage (Viên Mãn, index peakRealmSub) rolls over into the next realm major
// at substage 0 (Sơ Kỳ). peakRealmSub is injected (from MAX_REALM_SUB) rather
// than hardcoded so the sub-stage count lives in one place (the realm config).
export function nextStage(
  realmMajor: number,
  realmSub: number,
  peakRealmSub: number,
): { realmMajor: number; realmSub: number } {
  if (realmSub < peakRealmSub) {
    return { realmMajor, realmSub: realmSub + 1 };
  }
  return { realmMajor: realmMajor + 1, realmSub: 0 };
}

export function isMaxStage(
  realmMajor: number,
  realmSub: number,
  maxRealmMajor: number,
  peakRealmSub: number,
): boolean {
  return realmMajor === maxRealmMajor && realmSub === peakRealmSub;
}
