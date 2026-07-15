"use client";

import { formatNum } from "@/lib/format";

interface LingqiBarProps {
  linhKhi: number;
  linhKhiRequired: number;
}

export function LingqiBar({ linhKhi, linhKhiRequired }: LingqiBarProps) {
  const progress = Math.min(linhKhi / linhKhiRequired, 1);
  return (
    <div className="lingqi-bar-container">
      <div className="lingqi-header">
        <span className="lingqi-current">{formatNum(linhKhi)} linh khí</span>
        <span className="lingqi-required">
          Cần {formatNum(linhKhiRequired)} để đột phá
        </span>
      </div>
      <div className="lingqi-bar">
        <div className="lingqi-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
