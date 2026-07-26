"use client";

import type { CSSProperties } from "react";
import { ATTRIBUTE_LABELS } from "@/lib/attribute-constants";
import {
  getCongPhapRarityMeta,
  levelUpCost,
  passiveBonusAt,
  skillPowerAt,
} from "@/lib/congphap-display";
import { formatNum } from "@/lib/format";
import type { AttributeKey, CongPhapDTO, OwnedCongPhapDTO } from "@/lib/types";

interface CongPhapCardProps {
  entry: OwnedCongPhapDTO;
  /** Player's current Linh Thạch, to gate the upgrade button. */
  linhThach: number;
  /** True while a mutation for this card is in flight. */
  busy: boolean;
  onLevelUp: (congPhapId: string) => void;
  /** Only passed for active công pháp; absent hides the equip controls. */
  onEquip?: (congPhapId: string) => void;
  onUnequip?: (congPhapId: string) => void;
}

// One line per attribute this passive công pháp boosts at its current level.
function bonusLines(def: CongPhapDTO, level: number): string[] {
  const bonus = passiveBonusAt(def, level);
  return (Object.keys(bonus) as AttributeKey[]).map((key) => {
    const { flat, pct } = bonus[key] ?? { flat: 0, pct: 0 };
    const parts: string[] = [];
    if (flat !== 0) parts.push(`+${formatNum(flat)}`);
    if (pct !== 0) parts.push(`+${pct}%`);
    return `${ATTRIBUTE_LABELS[key]} ${parts.join(" ")}`;
  });
}

export function CongPhapCard({
  entry,
  linhThach,
  busy,
  onLevelUp,
  onEquip,
  onUnequip,
}: CongPhapCardProps) {
  const { def, level } = entry;
  const rarity = getCongPhapRarityMeta(def.rarity);
  const atMax = level >= def.maxLevel;
  const cost = atMax ? null : levelUpCost(def, level);
  const power = skillPowerAt(def, level);
  // A công pháp the admin soft-disabled stays owned but can't be used: the
  // backend rejects level-up/equip with CONGPHAP_NOT_FOUND, so mirror that here.
  const disabledDef = !def.active;
  const affordable = cost !== null && linhThach >= cost;

  // `cost` is null exactly when atMax, but the two branches below are computed
  // separately, so bind it once here to keep the narrowing explicit.
  const costLabel = cost === null ? "" : formatNum(cost);
  const upgradeLabel = disabledDef
    ? "Đã vô hiệu"
    : atMax
      ? "Đạt cấp tối đa"
      : affordable
        ? `Nâng cấp · ${costLabel} Linh Thạch`
        : `Thiếu Linh Thạch (${costLabel})`;

  return (
    <div
      className={`congphap-card${disabledDef ? " disabled" : ""}`}
      style={{ "--rarity": rarity.color } as CSSProperties}
    >
      <div className="congphap-card-head">
        <span className="congphap-glyph">{def.glyph}</span>
        <div className="congphap-card-title">
          <span className="congphap-name">{def.name}</span>
          <span className="congphap-rarity">{rarity.name}</span>
        </div>
        <span className="congphap-level">
          Cấp {level}
          <span className="congphap-level-max">/{def.maxLevel}</span>
        </span>
      </div>

      {disabledDef && (
        <span className="congphap-badge-off">Đã bị vô hiệu hóa</span>
      )}

      <p className="congphap-desc">{def.desc}</p>

      <div className="congphap-effects">
        {def.category === "passive" ? (
          bonusLines(def, level).map((line) => (
            <span className="congphap-effect" key={line}>
              {line}
            </span>
          ))
        ) : (
          <>
            <span className="congphap-effect">
              Sức mạnh {formatNum(power ?? 0)}
            </span>
            {def.chanNguyenCost !== null && (
              <span className="congphap-effect">
                Chân nguyên {formatNum(def.chanNguyenCost)}
              </span>
            )}
            <span className="congphap-effect-note">Hiệu lực khi Combat</span>
          </>
        )}
      </div>

      <div className="congphap-card-actions">
        <button
          type="button"
          className="congphap-btn congphap-btn-primary"
          disabled={busy || atMax || disabledDef || !affordable}
          onClick={() => onLevelUp(def.id)}
        >
          {upgradeLabel}
        </button>
        {def.category === "active" &&
          (entry.equippedSlot !== null
            ? onUnequip && (
                <button
                  type="button"
                  className="congphap-btn"
                  disabled={busy}
                  onClick={() => onUnequip(def.id)}
                >
                  Gỡ khỏi ô {entry.equippedSlot + 1}
                </button>
              )
            : onEquip && (
                <button
                  type="button"
                  className="congphap-btn"
                  disabled={busy || disabledDef}
                  onClick={() => onEquip(def.id)}
                >
                  Trang bị
                </button>
              ))}
      </div>
    </div>
  );
}
