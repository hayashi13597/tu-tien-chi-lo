"use client";

import gsap from "gsap";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { CongPhapCard } from "@/components/congphap-card";
import { LEARN_LINH_THACH_COST } from "@/lib/congphap-constants";
import { getCongPhapRarityMeta, skillPowerAt } from "@/lib/congphap-display";
import { formatNum } from "@/lib/format";
import { getRealmMeta } from "@/lib/realm-constants";
import type {
  CongPhapBranch,
  CongPhapDTO,
  MaterialInventoryDTO,
  OwnedCongPhapDTO,
} from "@/lib/types";

// Fixed number of active công pháp slots (backend ACTIVE_SLOTS = 4).
const ACTIVE_SLOTS = 4;

// Phase 2: nhóm nhánh trong mục "Chưa Sở Hữu" (thứ tự cố định; null = môn cơ bản).
const BRANCH_ORDER: (CongPhapBranch | null)[] = [
  "tuLuyen",
  "chienDao",
  "danDao",
  null,
];
const BRANCH_LABELS: Record<string, string> = {
  tuLuyen: "Tu Luyện",
  chienDao: "Chiến Đạo",
  danDao: "Đan Đạo",
};
function branchLabel(branch: CongPhapBranch | null): string {
  return branch === null ? "Cơ Bản" : (BRANCH_LABELS[branch] ?? branch);
}

interface CongPhapModalProps {
  open: boolean;
  owned: OwnedCongPhapDTO[];
  catalog: CongPhapDTO[];
  linhThach: number;
  /** Cảnh giới hiện tại (major, 0-based) — gate học môn Bí Tịch. */
  realmMajor: number;
  /** Buff hệ thống (Phase 2) từ GET /congphap — hiển thị ở strip header. */
  system: { linhKhiRatePct: number; danDaoSuccessPct: number };
  materialInventory: MaterialInventoryDTO[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRetry: () => void;
  onClose: () => void;
  onEquip: (congPhapId: string, slot: number) => void;
  onUnequip: (congPhapId: string) => void;
  onLevelUp: (congPhapId: string) => void;
  onLearn: (congPhapId: string) => void;
}

export function CongPhapModal({
  open,
  owned,
  catalog,
  linhThach,
  realmMajor,
  system,
  materialInventory,
  loading,
  error,
  busy,
  onRetry,
  onClose,
  onEquip,
  onUnequip,
  onLevelUp,
  onLearn,
}: CongPhapModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const staggeredRef = useRef(false);
  // Which empty slot the player is filling; null = not picking.
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  // Panel entrance, matching the pill modal.
  useEffect(() => {
    if (!open) {
      staggeredRef.current = false;
      setPickingSlot(null);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    gsap.fromTo(
      panel,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
  }, [open]);

  // Cards load lazily after open, so stagger on the first render where they
  // exist — and only once per open session, so refetches after a level-up
  // don't replay the entrance.
  useEffect(() => {
    if (!open || staggeredRef.current || owned.length === 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const cards = panel.querySelectorAll(".congphap-card");
    if (cards.length === 0) return;
    staggeredRef.current = true;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.05,
        delay: 0.1,
        ease: "power2.out",
      },
    );
  }, [open, owned]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pickingSlot !== null) setPickingSlot(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pickingSlot]);

  if (!open) return null;

  const actives = owned.filter((o) => o.def.category === "active");
  const passives = owned.filter((o) => o.def.category === "passive");
  const ownedIds = new Set(owned.map((o) => o.def.id));
  const unowned = catalog.filter((c) => !ownedIds.has(c.id));
  // Equippable = active, still enabled, and not already sitting in a slot.
  const equippable = actives.filter(
    (o) => o.equippedSlot === null && o.def.active,
  );

  const slotOccupant = (slot: number) =>
    actives.find((o) => o.equippedSlot === slot) ?? null;

  const handlePick = (congPhapId: string) => {
    if (pickingSlot === null) return;
    onEquip(congPhapId, pickingSlot);
    setPickingSlot(null);
  };

  return (
    <div className="pill-overlay">
      <button
        type="button"
        className="pill-backdrop"
        aria-label="Đóng công pháp"
        onClick={onClose}
      />
      <div ref={panelRef} className="pill-panel congphap-panel">
        <div className="pill-panel-title">
          <span>Công Pháp</span>
          <span className="congphap-purse">
            Linh Thạch: <strong>{formatNum(linhThach)}</strong>
          </span>
          <button type="button" className="pill-close" onClick={onClose}>
            Đóng
          </button>
        </div>

        {/* Phase 2: buff hệ thống từ môn đang sở hữu (ẩn khi cả hai = 0). */}
        {(system.linhKhiRatePct !== 0 || system.danDaoSuccessPct !== 0) && (
          <div className="congphap-system-strip">
            {system.linhKhiRatePct !== 0 && (
              <span>Tốc độ tu luyện +{system.linhKhiRatePct}%</span>
            )}
            {system.danDaoSuccessPct !== 0 && (
              <span>Hiệu suất luyện đan +{system.danDaoSuccessPct}%</span>
            )}
          </div>
        )}

        {error ? (
          <div className="pill-empty">
            <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</p>
            <button
              type="button"
              className="congphap-btn congphap-btn-primary"
              style={{ width: "auto" }}
              onClick={onRetry}
            >
              Thử Lại
            </button>
          </div>
        ) : loading && owned.length === 0 && catalog.length === 0 ? (
          <p className="pill-empty">Đang tải công pháp...</p>
        ) : (
          <>
            {/* 1. Four active slots. */}
            <h3 className="congphap-section">Ô Chủ Động ({ACTIVE_SLOTS})</h3>
            <div className="congphap-slot-grid">
              {Array.from({ length: ACTIVE_SLOTS }, (_, slot) => {
                const occupant = slotOccupant(slot);
                if (!occupant) {
                  return (
                    <button
                      // biome-ignore lint/suspicious/noArrayIndexKey: the slot number IS the identity the backend stores (OwnedCongPhap.equippedSlot 0..3), not an incidental array position.
                      key={slot}
                      type="button"
                      className={`congphap-slot empty${pickingSlot === slot ? " picking" : ""}`}
                      disabled={busy || equippable.length === 0}
                      onClick={() =>
                        setPickingSlot(pickingSlot === slot ? null : slot)
                      }
                    >
                      <span className="congphap-slot-plus">+</span>
                      <span className="congphap-slot-label">
                        Ô {slot + 1} — trống
                      </span>
                    </button>
                  );
                }
                const meta = getCongPhapRarityMeta(occupant.def.rarity);
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: same — slot number is the persisted identity.
                    key={slot}
                    className="congphap-slot filled"
                    style={{ "--rarity": meta.color } as CSSProperties}
                  >
                    <span className="congphap-slot-glyph">
                      {occupant.def.glyph}
                    </span>
                    <span className="congphap-slot-name">
                      {occupant.def.name}
                    </span>
                    <span className="congphap-slot-power">
                      Cấp {occupant.level} · Sức mạnh{" "}
                      {formatNum(
                        skillPowerAt(occupant.def, occupant.level) ?? 0,
                      )}
                    </span>
                    <button
                      type="button"
                      className="congphap-btn congphap-btn-slim"
                      disabled={busy}
                      onClick={() => onUnequip(occupant.def.id)}
                    >
                      Gỡ
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Picker appears only while filling a specific slot. */}
            {pickingSlot !== null && (
              <div className="congphap-picker">
                <span className="congphap-picker-title">
                  Chọn công pháp cho ô {pickingSlot + 1}
                </span>
                <div className="congphap-picker-list">
                  {equippable.map((o) => (
                    <button
                      key={o.def.id}
                      type="button"
                      className="congphap-picker-item"
                      disabled={busy}
                      onClick={() => handlePick(o.def.id)}
                    >
                      <span>{o.def.glyph}</span> {o.def.name} (Cấp {o.level})
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="congphap-btn congphap-btn-slim"
                  onClick={() => setPickingSlot(null)}
                >
                  Hủy
                </button>
              </div>
            )}

            {/* 2. Active công pháp owned (level up, equip). */}
            <h3 className="congphap-section">Công Pháp Chủ Động</h3>
            {actives.length === 0 ? (
              <p className="congphap-empty">
                Chưa sở hữu công pháp chủ động nào.
              </p>
            ) : (
              <div className="congphap-grid">
                {actives.map((entry) => (
                  <CongPhapCard
                    key={entry.def.id}
                    entry={entry}
                    linhThach={linhThach}
                    materialInventory={materialInventory}
                    busy={busy}
                    onLevelUp={onLevelUp}
                    onEquip={() => {
                      // Equip into the first free slot; if all are taken the
                      // player picks which slot to replace.
                      const free = Array.from(
                        { length: ACTIVE_SLOTS },
                        (_, i) => i,
                      ).find((i) => slotOccupant(i) === null);
                      if (free !== undefined) onEquip(entry.def.id, free);
                      else setPickingSlot(0);
                    }}
                    onUnequip={onUnequip}
                  />
                ))}
              </div>
            )}

            {/* 3. Passive công pháp — always on. */}
            <h3 className="congphap-section">
              Công Pháp Bị Động
              <span className="congphap-section-note">
                luôn có hiệu lực, cộng thẳng vào thuộc tính
              </span>
            </h3>
            {passives.length === 0 ? (
              <p className="congphap-empty">
                Chưa sở hữu công pháp bị động nào.
              </p>
            ) : (
              <div className="congphap-grid">
                {passives.map((entry) => (
                  <CongPhapCard
                    key={entry.def.id}
                    entry={entry}
                    linhThach={linhThach}
                    materialInventory={materialInventory}
                    busy={busy}
                    onLevelUp={onLevelUp}
                  />
                ))}
              </div>
            )}

            {/* 4. Not owned yet — Phase 2: nhóm theo nhánh; môn gắn Bí Tịch học được. */}
            {unowned.length > 0 && (
              <>
                <h3 className="congphap-section">
                  Chưa Sở Hữu
                  <span className="congphap-section-note">
                    học bằng Bí Tịch hoặc nhận qua đổi code
                  </span>
                </h3>
                {BRANCH_ORDER.map((branch) => {
                  const group = unowned.filter((c) => c.branch === branch);
                  if (group.length === 0) return null;
                  return (
                    <div key={branch ?? "base"}>
                      <h4 className="congphap-branch-heading">
                        {branchLabel(branch)}
                      </h4>
                      <div className="congphap-grid">
                        {group.map((def) => {
                          const meta = getCongPhapRarityMeta(def.rarity);
                          const realmOk = realmMajor >= def.minRealmMajor;
                          const biTichOk = (def.biTichOwned ?? 0) >= 1;
                          const linhThachOk =
                            linhThach >= LEARN_LINH_THACH_COST;
                          const learnReason = !realmOk
                            ? `Cần đạt cảnh giới ${getRealmMeta(def.minRealmMajor).name}`
                            : !biTichOk
                              ? "Thiếu Bí Tịch"
                              : !linhThachOk
                                ? "Thiếu Linh Thạch"
                                : null;
                          return (
                            <div
                              key={def.id}
                              className="congphap-card locked"
                              style={
                                { "--rarity": meta.color } as CSSProperties
                              }
                            >
                              <div className="congphap-card-head">
                                <span className="congphap-glyph">
                                  {def.glyph}
                                </span>
                                <div className="congphap-card-title">
                                  <span className="congphap-name">
                                    {def.name}
                                  </span>
                                  <span className="congphap-rarity">
                                    {meta.name}
                                  </span>
                                </div>
                              </div>
                              <p className="congphap-desc">{def.desc}</p>
                              <span className="congphap-effect-note">
                                {def.category === "passive"
                                  ? "Bị động"
                                  : "Chủ động"}
                              </span>
                              {def.biTichMaterialId !== null ? (
                                <div className="congphap-learn">
                                  <button
                                    type="button"
                                    className="congphap-btn congphap-btn-primary"
                                    disabled={busy || learnReason !== null}
                                    title={
                                      learnReason ??
                                      `Học bằng 1 Bí Tịch + ${LEARN_LINH_THACH_COST} Linh Thạch`
                                    }
                                    onClick={() => onLearn(def.id)}
                                  >
                                    Học · 1 Bí Tịch + {LEARN_LINH_THACH_COST} LT
                                  </button>
                                  {learnReason !== null && (
                                    <small className="alchemy-recipe-lock">
                                      {learnReason}
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <span className="congphap-effect-note">
                                  Nhận qua đổi code
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
