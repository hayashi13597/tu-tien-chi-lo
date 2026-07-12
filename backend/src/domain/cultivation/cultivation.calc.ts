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
}): number {
  const cap = params.offlineCapSeconds ?? OFFLINE_CAP_SECONDS;
  const elapsedSeconds = Math.max(0, (params.now.getTime() - params.lastUpdateAt.getTime()) / 1000);
  // Cap accrual at `cap` seconds (24h) so a character offline for a week doesn't
  // accrue a week's worth of linh khí in one lazy recomputation.
  const cappedSeconds = Math.min(elapsedSeconds, cap);
  return params.storedLinhKhi + cappedSeconds * params.cultivationRate;
}
