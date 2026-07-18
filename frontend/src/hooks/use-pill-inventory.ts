"use client";

import { useCallback, useEffect, useState } from "react";
import { consumePill, fetchInventory } from "@/lib/api";
import type { CultivationState, PillInventoryItem } from "@/lib/types";

export interface UsePillInventoryResult {
  inventory: PillInventoryItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  consume: (pillId: string) => Promise<CultivationState>;
}

// Server-backed inventory list. `enabled` gates the initial load so the fetch
// only fires once the modal opens (lazy), not on dashboard mount.
export function usePillInventory(enabled: boolean): UsePillInventoryResult {
  const [inventory, setInventory] = useState<PillInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const inv = await fetchInventory();
      setInventory(inv);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được kho đan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  const consume = useCallback(
    async (pillId: string): Promise<CultivationState> => {
      // Server is authoritative: POST first, then re-read the list so quantities
      // (and any 0-drop) reflect the committed state. The refetch runs even when
      // the POST rejects — a 409 (out of stock) means the local list is stale,
      // and re-syncing it is exactly what the error path needs. The fresh
      // cultivation state is returned to the caller to reconcile the dashboard.
      try {
        return await consumePill(pillId);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  return { inventory, loading, error, refetch, consume };
}
