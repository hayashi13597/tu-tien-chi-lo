"use client";

import { useCallback, useEffect, useState } from "react";
import {
  equipCongPhap,
  fetchCongPhap,
  levelUpCongPhap,
  unequipCongPhap,
} from "@/lib/api";
import type { CongPhapDTO, LevelUpResult, OwnedCongPhapDTO } from "@/lib/types";

export interface UseCongPhapResult {
  owned: OwnedCongPhapDTO[];
  catalog: CongPhapDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  equip: (congPhapId: string, slot: number) => Promise<void>;
  unequip: (congPhapId: string) => Promise<void>;
  levelUp: (congPhapId: string) => Promise<LevelUpResult>;
}

// Server-backed công pháp list. `enabled` gates the initial load so the fetch
// only fires once the modal opens (lazy), not on dashboard mount — same
// contract as usePillInventory.
export function useCongPhap(enabled: boolean): UseCongPhapResult {
  const [owned, setOwned] = useState<OwnedCongPhapDTO[]>([]);
  const [catalog, setCatalog] = useState<CongPhapDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCongPhap();
      setOwned(data.owned);
      setCatalog(data.catalog);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được công pháp");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  // All three mutations are server-authoritative: POST first, then re-read the
  // list. The refetch runs even when the POST rejects — a 409 (max level, not
  // enough Linh Thạch) means the local copy is stale, and re-syncing is exactly
  // what the error path needs.
  const equip = useCallback(
    async (congPhapId: string, slot: number) => {
      try {
        await equipCongPhap(congPhapId, slot);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  const unequip = useCallback(
    async (congPhapId: string) => {
      try {
        await unequipCongPhap(congPhapId);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  const levelUp = useCallback(
    async (congPhapId: string): Promise<LevelUpResult> => {
      try {
        return await levelUpCongPhap(congPhapId);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  return { owned, catalog, loading, error, refetch, equip, unequip, levelUp };
}
