"use client";

import { formatNum, formatSeconds } from "@/lib/format";
import { getRealmMeta, getSubStageName } from "@/lib/realm-constants";
import type { CultivationState } from "@/lib/types";

interface StatsPanelProps {
  state: CultivationState;
  punishmentRemaining: number | null;
}

export function StatsPanel({ state, punishmentRemaining }: StatsPanelProps) {
  const meta = getRealmMeta(state.realmMajor);
  const subName = getSubStageName(state.realmSub);
  const progress = ((state.linhKhi / state.linhKhiRequired) * 100).toFixed(1);

  return (
    <aside className="panel">
      <div className="panel-title">Tu Hành Bảng</div>
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
          {state.cultivationRate.toFixed(2)}/giây
        </span>
      </div>
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
