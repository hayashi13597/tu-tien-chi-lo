"use client";

import { DiamondMarker } from "@/components/icons";
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from "@/lib/attribute-constants";
import { attributeDelta } from "@/lib/congphap-display";
import { formatNum } from "@/lib/format";
import type { CultivationState } from "@/lib/types";

interface AttributePanelProps {
  state: CultivationState;
}

// Combat-side counterpart to StatsPanel: same .panel chrome and .stat-row
// rhythm, but sourced from realm base attributes + passive công pháp rather
// than the cultivation loop.
export function AttributePanel({ state }: AttributePanelProps) {
  // Gain contributed by passive công pháp, shown as a gold suffix next to the
  // final value — same visual language as the breakthrough boost's (+N%).
  const delta = attributeDelta(state.attributes.base, state.attributes.final);

  return (
    <aside className="panel">
      <div className="panel-title">
        <DiamondMarker className="panel-title-marker" />
        Chiến Lực &amp; Thuộc Tính
      </div>
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
