"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMaterials } from "@/lib/api";
import type { MaterialInventoryDTO } from "@/lib/types";

export interface UseMaterialInventoryResult {
  inventory: MaterialInventoryDTO[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Material balances are lazy-loaded when the alchemy/progression UI needs
// them. No local decrement is performed; the backend remains authoritative.
export function useMaterialInventory(
  enabled: boolean,
): UseMaterialInventoryResult {
  const [inventory, setInventory] = useState<MaterialInventoryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setInventory(await fetchMaterials());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được nguyên liệu",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  return { inventory, loading, error, refetch };
}
