"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // Xóa cờ settle sau khi UI toast xong để các refetch/render sau không toast lặp.
  clearLastSettled: () => void;
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
  // Queue của lần fetch trước để diff completed jobs ngoài setState updater
  // (updater phải thuần; diff theo id vì index đổi khi có job mới xếp vào).
  const previousQueueRef = useRef<AlchemyQueueDTO | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRecipes, nextQueue, nextProfile] = await Promise.all([
        fetchAlchemyRecipes(),
        fetchAlchemyQueue(),
        fetchAlchemyProfile(),
      ]);
      setRecipes(nextRecipes);
      const previous = previousQueueRef.current;
      if (previous) {
        const prevStatus = new Map(
          previous.jobs.map((job) => [job.id, job.status]),
        );
        const justCompleted = nextQueue.jobs.filter(
          (job) =>
            job.status === "completed" &&
            prevStatus.get(job.id) !== "completed",
        );
        if (justCompleted.length > 0) {
          setLastSettled({
            completedJobIds: justCompleted.map((job) => job.id),
          });
        }
      }
      previousQueueRef.current = nextQueue;
      setQueue(nextQueue);
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

  const clearLastSettled = useCallback(() => setLastSettled(null), []);

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
    clearLastSettled,
    loading,
    error,
    refetch,
    enqueue,
    rankUp,
    upgradeFurnace,
  };
}
