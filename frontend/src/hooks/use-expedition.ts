"use client";

import { useCallback, useEffect, useState } from "react";
import {
  claimExpedition,
  fetchCurrentExpedition,
  fetchExpeditionBranches,
  startExpedition,
} from "@/lib/api";
import type {
  CurrentExpeditionDTO,
  ExpeditionBranchDTO,
  ExpeditionClaimDTO,
  ExpeditionDTO,
  StartExpeditionInput,
} from "@/lib/types";

export interface UseExpeditionResult {
  branches: ExpeditionBranchDTO[];
  current: CurrentExpeditionDTO | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  start: (input: StartExpeditionInput) => Promise<ExpeditionDTO>;
  claim: () => Promise<ExpeditionClaimDTO>;
}

// The expedition drawer consumes one server snapshot for both catalog and
// current state. Mutations always re-read it, so quota/status never rely on
// optimistic client bookkeeping.
export function useExpedition(enabled: boolean): UseExpeditionResult {
  const [branches, setBranches] = useState<ExpeditionBranchDTO[]>([]);
  const [current, setCurrent] = useState<CurrentExpeditionDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [nextBranches, nextCurrent] = await Promise.all([
        fetchExpeditionBranches(),
        fetchCurrentExpedition(),
      ]);
      setBranches(nextBranches);
      setCurrent(nextCurrent);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được bí cảnh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  const start = useCallback(
    async (input: StartExpeditionInput): Promise<ExpeditionDTO> => {
      try {
        return await startExpedition(input);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  const claim = useCallback(async (): Promise<ExpeditionClaimDTO> => {
    try {
      return await claimExpedition();
    } finally {
      await refetch();
    }
  }, [refetch]);

  return { branches, current, loading, error, refetch, start, claim };
}
