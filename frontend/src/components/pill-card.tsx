"use client";

import type { CSSProperties } from "react";
import { getRarityMeta } from "@/lib/pill-constants";
import type { PillInventoryItem } from "@/lib/types";

interface PillCardProps {
  item: PillInventoryItem;
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
  const rarity = getRarityMeta(item.rarity);

  return (
    <div
      className="pill-card"
      style={{ "--rarity": rarity.color } as CSSProperties}
    >
      <div className="pill-orb">
        <span className="pill-glyph">{item.glyph}</span>
      </div>
      <span className="pill-name">{item.name}</span>
      <span className="pill-rarity">{rarity.name}</span>
      <p className="pill-desc">{item.desc}</p>
      <span className="pill-qty">Số lượng: ×{item.quantity}</span>
      <button
        type="button"
        className="pill-use-btn"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onUse(item.id)}
      >
        {disabled ? (disabledReason ?? "Không thể dùng") : "Dùng"}
      </button>
    </div>
  );
}
