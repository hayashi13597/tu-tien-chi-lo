"use client";

import { DiamondMarker } from "@/components/icons";
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from "@/lib/attribute-constants";
import { attributeDelta } from "@/lib/congphap-display";
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
  // Gain contributed by passive công pháp, shown as a gold suffix next to the
  // final value — same visual language as the breakthrough boost's (+N%).
  const delta = attributeDelta(state.attributes.base, state.attributes.final);

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
            Trọng thương ({formatSeconds(punishmentRemaining)})
          </span>
        ) : state.canBreakthrough ? (
          <span className="stat-value jade">Sẵn sàng đột phá</span>
        ) : (
          <span className="stat-value">Đang tu luyện</span>
        )}
      </div>

      {/* Combat-side stats. Kept in the same panel but visually separated:
          these come from realm base attributes + passive công pháp, not from
          the cultivation loop above. */}
      <div className="stat-divider">Chiến Lực &amp; Thuộc Tính</div>
      <div className="stat-battle-power">
        <span className="stat-label">Chiến lực</span>
        <span className="stat-battle-power-value">
          {formatNum(state.battlePower)}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Linh Thạch</span>
        <span className="stat-value jade">{formatNum(state.linhThach)}</span>
      </div>
      {ATTRIBUTE_ORDER.map((key) => {
        const gain = Math.round(delta[key]);
        return (
          <div className="stat-row" key={key}>
            <span className="stat-label">{ATTRIBUTE_LABELS[key]}</span>
            <span className="stat-value">
              {formatNum(state.attributes.final[key])}
              {gain > 0 && <span className="stat-value gold"> (+{gain})</span>}
            </span>
          </div>
        );
      })}
    </aside>
  );
}
