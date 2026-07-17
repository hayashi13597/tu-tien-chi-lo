// Linh khí accrues continuously and lazily: rather than a cron job ticking
// every character forward, we recompute "what would linh khí be right now"
// from the last persisted snapshot every time a request needs it. This keeps
// GET /cultivation/state cheap to poll (no writes) and never loses progress.
export const OFFLINE_CAP_SECONDS = 24 * 60 * 60;

export function computeLinhKhi(params: {
  storedLinhKhi: number;
  lastUpdateAt: Date;
  now: Date;
  cultivationRate: number;
  offlineCapSeconds?: number;
  // Optional active timed buff. The window [lastUpdateAt, now] is split into a
  // buffed segment [lastUpdateAt, min(now, until)] accruing at rate × multiplier
  // and the remainder accruing at rate. Absent/expired buff ⇒ today's behavior.
  buff?: { multiplier: number; until: Date };
}): number {
  const cap = params.offlineCapSeconds ?? OFFLINE_CAP_SECONDS;
  const totalElapsed = Math.max(0, (params.now.getTime() - params.lastUpdateAt.getTime()) / 1000);
  // Cap first (existing rule): a week offline must not accrue a week of linh khí.
  const cappedSeconds = Math.min(totalElapsed, cap);
  const cappedEnd = params.lastUpdateAt.getTime() + cappedSeconds * 1000;

  let buffedSeconds = 0;
  if (params.buff) {
    // Overlap of [lastUpdateAt, cappedEnd] with (-inf, until]. Clamp to >= 0 so
    // an already-expired buff contributes nothing.
    const buffEnd = Math.min(cappedEnd, params.buff.until.getTime());
    buffedSeconds = Math.max(0, (buffEnd - params.lastUpdateAt.getTime()) / 1000);
  }
  const plainSeconds = cappedSeconds - buffedSeconds;

  const multiplier = params.buff?.multiplier ?? 1;
  return (
    params.storedLinhKhi +
    buffedSeconds * params.cultivationRate * multiplier +
    plainSeconds * params.cultivationRate
  );
}
