"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAlchemyQueue,
  fetchAlchemyRecipes,
  queueAlchemy,
} from "@/lib/api";
import type { AlchemyQueueDTO, AlchemyRecipeDTO } from "@/lib/types";

export interface UseAlchemyQueueResult {
  recipes: AlchemyRecipeDTO[];
  queue: AlchemyQueueDTO | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  enqueue: (recipeId: string, quantity: number) => Promise<AlchemyQueueDTO>;
}

// Reading the queue settles completed jobs on the server. Refetching after an
// enqueue therefore also refreshes newly produced output and the next job.
export function useAlchemyQueue(enabled: boolean): UseAlchemyQueueResult {
  const [recipes, setRecipes] = useState<AlchemyRecipeDTO[]>([]);
  const [queue, setQueue] = useState<AlchemyQueueDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRecipes, nextQueue] = await Promise.all([
        fetchAlchemyRecipes(),
        fetchAlchemyQueue(),
      ]);
      setRecipes(nextRecipes);
      setQueue(nextQueue);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được lò luyện đan",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  const enqueue = useCallback(
    async (recipeId: string, quantity: number): Promise<AlchemyQueueDTO> => {
      try {
        return await queueAlchemy(recipeId, quantity);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  return { recipes, queue, loading, error, refetch, enqueue };
}
