"use client";

import { curveHeights } from "@/lib/realm-curve";

interface RealmCurveProps {
  values: number[];
  size?: "sm" | "lg";
}

export function RealmCurve({ values, size = "sm" }: RealmCurveProps) {
  const heights = curveHeights(values);
  return (
    <div
      className={`admin-curve${size === "lg" ? " admin-curve--lg" : ""}`}
      aria-hidden
    >
      {heights.map((h, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: mỗi cột là một tiểu cảnh giới theo vị trí
          key={i}
          className="admin-curve-bar"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}
