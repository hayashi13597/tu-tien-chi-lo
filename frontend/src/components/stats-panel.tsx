"use client";

import { DiamondMarker } from "@/components/icons";
import { formatNum, formatSeconds } from "@/lib/format";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type { CultivationState } from "@/lib/types";

interface StatsPanelProps {
  state: CultivationState;
  punishmentRemaining: number | null;
  /** Rate currently in effect (base × buff multiplier while buffed). */
  effectiveRate: number;
}

export function StatsPanel({
  state,
  punishmentRemaining,
  effectiveRate,
}: StatsPanelProps) {
  const meta = getRealmMeta(state.realmMajor);
  const subName = getSubStageName(state.realmSub);
  const progress = ((state.linhKhi / state.linhKhiRequired) * 100).toFixed(1);

  return (
    <aside className="panel">
      <div className="panel-title">
        <DiamondMarker className="panel-title-marker" />
        Tu Hành Bảng
      </div>
      <div className="stat-row">
        <span className="stat-label">Cảnh giới</span>
        <span className="stat-value gold">{meta.name}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Giai đoạn</span>
        <span className="stat-value">{subName}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Linh khí</span>
        <span className="stat-value jade">{formatNum(state.linhKhi)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Cần để đột phá</span>
        <span className="stat-value">{formatNum(state.linhKhiRequired)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Tiến độ</span>
        <span className="stat-value gold">{progress}%</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Tốc độ tu luyện</span>
        <span className="stat-value jade">
          {effectiveRate.toFixed(2)}/giây
          {/* Buffed: show the boosted rate is temporary, gold like other boons. */}
          {effectiveRate > state.cultivationRate &&
            state.cultivationBuffMultiplier && (
              <span className="stat-value gold">
                {" "}
                (×{state.cultivationBuffMultiplier})
              </span>
            )}
        </span>
      </div>
      {/* Chance the next breakthrough would succeed (base + pity + boost).
          Hidden at max stage, where no breakthrough is possible. */}
      {!state.isMaxStage && (
        <div className="stat-row">
          <span className="stat-label">Tỷ lệ đột phá</span>
          <span
            className={`stat-value ${
              state.breakthroughBonusPct > 0 ? "gold" : "jade"
            }`}
          >
            {state.breakthroughSuccessRate.toFixed(1)}%
            {/* Show the pending boost is what lifted the rate. */}
            {state.breakthroughBonusPct > 0 && (
              <span className="stat-value gold">
                {" "}
                (+{state.breakthroughBonusPct}%)
              </span>
            )}
          </span>
        </div>
      )}
      <div className="stat-row">
        <span className="stat-label">Trạng thái</span>
        {state.isMaxStage ? (
          <span className="stat-value gold">Cực cảnh</span>
        ) : punishmentRemaining !== null ? (
          <span className="stat-value danger">
            Bị phạt ({formatSeconds(punishmentRemaining)})
          </span>
        ) : state.canBreakthrough ? (
          <span className="stat-value jade">Sẵn sàng đột phá</span>
        ) : (
          <span className="stat-value">Đang tu luyện</span>
        )}
      </div>
    </aside>
  );
}
