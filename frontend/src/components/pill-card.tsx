"use client";

import type { CSSProperties } from "react";
import { getRarityMeta } from "@/lib/pill-constants";
import type { InventoryPill } from "@/lib/types";

interface PillCardProps {
  item: InventoryPill;
  disabled: boolean;
  disabledReason?: string;
  onUse: (pillId: string) => void;
}

export function PillCard({
  item,
  disabled,
  disabledReason,
  onUse,
}: PillCardProps) {
  const { def, quantity } = item;
  const rarity = getRarityMeta(def.rarity);

  return (
    <div
      className="pill-card"
      style={{ "--rarity": rarity.color } as CSSProperties}
    >
      <div className="pill-orb">
        <span className="pill-glyph">{def.glyph}</span>
      </div>
      <span className="pill-name">{def.name}</span>
      <span className="pill-rarity">{rarity.name}</span>
      <p className="pill-desc">{def.desc}</p>
      <span className="pill-qty">Số lượng: ×{quantity}</span>
      <button
        type="button"
        className="pill-use-btn"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onUse(def.id)}
      >
        {disabled ? (disabledReason ?? "Không thể dùng") : "Dùng"}
      </button>
    </div>
  );
}
