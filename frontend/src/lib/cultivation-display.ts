// Pure display-side mirrors of the backend's buffed accrual (computeLinhKhi):
// the server's CultivationState DTO reports the *base* stage rate and the buff
// (multiplier + until) separately, so anything the UI shows per-second must
// combine them itself — otherwise a consumed speed pill looks like a no-op
// between polls.

export interface BuffFields {
  cultivationRate: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: string | null; // ISO 8601
}

/**
 * Accrual rate in effect at `nowMs`: base rate × multiplier while the timed
 * buff is active, base rate otherwise (absent or expired buff).
 */
export function effectiveCultivationRate(
  state: BuffFields,
  nowMs: number,
): number {
  const { cultivationRate, cultivationBuffMultiplier, cultivationBuffUntil } =
    state;
  const buffActive =
    cultivationBuffMultiplier !== null &&
    cultivationBuffUntil !== null &&
    new Date(cultivationBuffUntil).getTime() > nowMs;
  return buffActive
    ? cultivationRate * cultivationBuffMultiplier
    : cultivationRate;
}

/**
 * Interpolate linh khí between server polls, splitting [lastFetchMs, nowMs]
 * into a buffed segment (rate × multiplier, up to `cultivationBuffUntil`) and
 * a plain remainder — the same piecewise rule the backend applies, so the bar
 * neither lags during a buff nor keeps sprinting after it expires.
 */
export function interpolateLinhKhi(
  state: BuffFields & { linhKhi: number },
  lastFetchMs: number,
  nowMs: number,
): number {
  const elapsed = Math.max(0, (nowMs - lastFetchMs) / 1000);

  let buffedSeconds = 0;
  if (
    state.cultivationBuffMultiplier !== null &&
    state.cultivationBuffUntil !== null
  ) {
    // Overlap of [lastFetchMs, nowMs] with (-inf, until]; clamp so an
    // already-expired buff contributes nothing.
    const buffEnd = Math.min(
      nowMs,
      new Date(state.cultivationBuffUntil).getTime(),
    );
    buffedSeconds = Math.min(
      elapsed,
      Math.max(0, (buffEnd - lastFetchMs) / 1000),
    );
  }
  const plainSeconds = elapsed - buffedSeconds;
  const multiplier = state.cultivationBuffMultiplier ?? 1;

  return (
    state.linhKhi +
    buffedSeconds * state.cultivationRate * multiplier +
    plainSeconds * state.cultivationRate
  );
}
