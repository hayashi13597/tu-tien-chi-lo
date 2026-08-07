"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAlchemyProfile,
  fetchAlchemyQueue,
  fetchAlchemyRecipes,
  queueAlchemy,
  rankUpAlchemy,
  upgradeAlchemyFurnace,
} from "@/lib/api";
import type {
  AlchemyProfileDTO,
  AlchemyQueueDTO,
  AlchemyRecipeDTO,
} from "@/lib/types";

export interface UseAlchemyQueueResult {
  recipes: AlchemyRecipeDTO[];
  queue: AlchemyQueueDTO | null;
  profile: AlchemyProfileDTO | null;
  lastSettled: { completedJobIds: string[] } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  enqueue: (recipeId: string, quantity: number) => Promise<AlchemyQueueDTO>;
  rankUp: () => Promise<void>;
  upgradeFurnace: () => Promise<void>;
}

// Fetch profile cùng queue: server settle+lazy-create trong cùng một lượt.
export function useAlchemyQueue(enabled: boolean): UseAlchemyQueueResult {
  const [recipes, setRecipes] = useState<AlchemyRecipeDTO[]>([]);
  const [queue, setQueue] = useState<AlchemyQueueDTO | null>(null);
  const [profile, setProfile] = useState<AlchemyProfileDTO | null>(null);
  const [lastSettled, setLastSettled] =
    useState<UseAlchemyQueueResult["lastSettled"]>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRecipes, nextQueue, nextProfile] = await Promise.all([
        fetchAlchemyRecipes(),
        fetchAlchemyQueue(),
        fetchAlchemyProfile(),
      ]);
      setRecipes(nextRecipes);
      setQueue((previous) => {
        if (
          previous &&
          nextQueue.jobs.some(
            (job, i) =>
              job.status === "completed" &&
              previous.jobs[i]?.status !== "completed",
          )
        ) {
          setLastSettled({
            completedJobIds: nextQueue.jobs
              .filter((j) => j.status === "completed")
              .map((j) => j.id),
          });
        }
        return nextQueue;
      });
      setProfile(nextProfile);
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
    async (recipeId: string, quantity: number) => {
      try {
        return await queueAlchemy(recipeId, quantity);
      } finally {
        await refetch();
      }
    },
    [refetch],
  );

  const rankUp = useCallback(async () => {
    await rankUpAlchemy();
    await refetch();
  }, [refetch]);

  const upgradeFurnace = useCallback(async () => {
    await upgradeAlchemyFurnace();
    await refetch();
  }, [refetch]);

  return {
    recipes,
    queue,
    profile,
    lastSettled,
    loading,
    error,
    refetch,
    enqueue,
    rankUp,
    upgradeFurnace,
  };
}
