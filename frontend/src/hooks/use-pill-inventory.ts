"use client";

import { useCallback, useEffect, useState } from "react";
import { getRarityMeta, SEED_INVENTORY } from "@/lib/pill-constants";
import { applyConsume, expireBuffs } from "@/lib/pill-logic";
import type { ActiveBuff, InventoryPill } from "@/lib/types";

export interface ConsumeCallbacks {
  onLinhKhi: (amount: number, color: string) => void;
  onCultivationBuff: (label: string, color: string) => void;
  onBreakthroughBoost: (label: string, color: string) => void;
  onClearPunishment: (color: string) => void;
}

export interface UsePillInventoryResult {
  inventory: InventoryPill[];
  activeBuffs: ActiveBuff[];
  breakthroughBonusPct: number;
  consume: (pillId: string, callbacks: ConsumeCallbacks) => void;
  clearBreakthroughBoost: () => void;
  now: number;
}

export function usePillInventory(): UsePillInventoryResult {
  const [inventory, setInventory] = useState<InventoryPill[]>(SEED_INVENTORY);
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [now, setNow] = useState(Date.now());

  // 1s tick drives buff countdown display and expiry (mirrors the cultivation
  // hook's own tick — buffs are client-only and independent of the server poll).
  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setActiveBuffs((prev) => {
        const next = expireBuffs(prev, t);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const clearBreakthroughBoost = useCallback(() => {
    setActiveBuffs((prev) =>
      prev.filter((b) => b.kind !== "breakthroughBoost"),
    );
  }, []);

  const consume = useCallback(
    (pillId: string, callbacks: ConsumeCallbacks) => {
      const item = inventory.find((i) => i.def.id === pillId);
      if (!item) return;
      const { def } = item;
      const color = getRarityMeta(def.rarity).color;
      const e = def.effect;

      setInventory((prev) => applyConsume(prev, pillId));

      switch (e.kind) {
        case "linhKhi":
          callbacks.onLinhKhi(e.amount ?? 0, color);
          break;
        case "cultivationBuff": {
          const label = `${def.name} ×${e.multiplier}`;
          setActiveBuffs((prev) => [
            // One cultivation buff at a time: drop any existing one, then add
            // the fresh one with a renewed expiry (refresh, never stack).
            ...prev.filter((b) => b.kind !== "cultivationBuff"),
            {
              kind: "cultivationBuff",
              label,
              multiplier: e.multiplier,
              expiresAt: Date.now() + (e.durationSec ?? 0) * 1000,
            },
          ]);
          callbacks.onCultivationBuff(label, color);
          break;
        }
        case "breakthroughBoost": {
          const label = `+${e.bonusPct}% đột phá`;
          setActiveBuffs((prev) => [
            ...prev.filter((b) => b.kind !== "breakthroughBoost"),
            { kind: "breakthroughBoost", label, bonusPct: e.bonusPct },
          ]);
          callbacks.onBreakthroughBoost(label, color);
          break;
        }
        case "clearPunishment":
          callbacks.onClearPunishment(color);
          break;
      }
    },
    [inventory],
  );

  const breakthroughBonusPct =
    activeBuffs.find((b) => b.kind === "breakthroughBoost")?.bonusPct ?? 0;

  return {
    inventory,
    activeBuffs,
    breakthroughBonusPct,
    consume,
    clearBreakthroughBoost,
    now,
  };
}
