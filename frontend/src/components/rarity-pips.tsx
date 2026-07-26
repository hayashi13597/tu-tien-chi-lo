"use client";

import { RARITY_PIPS, rarityPipCount } from "@/lib/pill-constants";

interface RarityPipsProps {
  rarity: number;
  color: string;
  size?: "sm" | "lg";
}

export function RarityPips({ rarity, color, size = "sm" }: RarityPipsProps) {
  const filled = rarityPipCount(rarity);
  return (
    <div
      className={`admin-pips${size === "lg" ? " admin-pips--lg" : ""}`}
      style={{ color }}
      aria-hidden
    >
      {Array.from({ length: RARITY_PIPS }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: năm ô cố định theo vị trí
          key={i}
          className={`admin-pip${i < filled ? " filled tint" : ""}`}
        />
      ))}
    </div>
  );
}
