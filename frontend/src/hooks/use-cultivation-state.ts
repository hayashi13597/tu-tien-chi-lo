"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CultivationState } from "@/lib/types";

interface UseCultivationStateResult {
  state: CultivationState | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Linh khí interpolated between polls, recomputed every 1s tick. */
  displayLinhKhi: number;
  /** Seconds of punishment remaining, or null when not punished. */
  punishmentRemaining: number | null;
  /** Current epoch ms, ticking every 1s to drive countdowns/interpolation. */
  now: number;
}

export function useCultivationState(
  isAuthenticated: boolean,
  onAuthExpired: () => void,
): UseCultivationStateResult {
  const [state, setState] = useState<CultivationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const lastFetchRef = useRef<number>(0);

  const refetch = useCallback(async () => {
    try {
      const data = await apiFetch<CultivationState>("/cultivation/state");
      setState(data);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (err) {
      // apiFetch throws this exact message when a refresh could not recover the
      // session; treat it as a redirect signal rather than an inline error.
      if (
        err instanceof Error &&
        err.message.includes("Authentication expired")
      ) {
        onAuthExpired();
      } else {
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired]);

  // Poll server truth every 10s while authenticated.
  useEffect(() => {
    if (isAuthenticated) {
      refetch();
      const interval = setInterval(refetch, 10_000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, refetch]);

  // 1s tick powers both linh-khí interpolation and punishment countdown.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Linear interpolation: stored linh khí + rate * seconds since the last poll.
  const displayLinhKhi = (() => {
    if (!state) return 0;
    const elapsed = (now - lastFetchRef.current) / 1000;
    return state.linhKhi + elapsed * state.cultivationRate;
  })();

  const punishmentRemaining = (() => {
    if (!state?.punishedUntil) return null;
    const diff = (new Date(state.punishedUntil).getTime() - now) / 1000;
    return diff > 0 ? diff : null;
  })();

  return {
    state,
    error,
    loading,
    refetch,
    displayLinhKhi,
    punishmentRemaining,
    now,
  };
}
