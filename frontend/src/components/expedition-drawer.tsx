"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canStartExpedition,
  expeditionUiMode,
  formatExpeditionDuration,
  formatExpeditionTicketCost,
  rewardPercentForWins,
  secondsRemaining,
} from "@/lib/expedition-display";
import { getRealmMeta } from "@/lib/realm-constants";
import type {
  CurrentExpeditionDTO,
  ExpeditionBranchDTO,
  ExpeditionDifficultyKey,
  ExpeditionDurationSec,
  PillInventoryItem,
  StartExpeditionInput,
} from "@/lib/types";

// Phase 3 — nhãn tầng theo bậc Phàm/Linh/Thiên.
const TIER_LABELS: Record<number, string> = {
  1: "Phàm Giai",
  2: "Linh Giai",
  3: "Thiên Giai",
};

interface ExpeditionDrawerProps {
  open: boolean;
  branches: ExpeditionBranchDTO[];
  current: CurrentExpeditionDTO | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  now: Date;
  // Phase 3 — gate nhánh + cảnh báo chiến lực + loadout đan combat.
  realmMajor: number;
  battlePower: number;
  combatPills: PillInventoryItem[];
  onRetry: () => void;
  onClose: () => void;
  onStart: (input: StartExpeditionInput) => void;
  onClaim: () => void;
}

const DURATIONS: ExpeditionDurationSec[] = [1800, 7200, 28800];
const DIFFICULTIES: ExpeditionDifficultyKey[] = ["easy", "normal", "hard"];

export function ExpeditionDrawer({
  open,
  branches,
  current,
  loading,
  error,
  busy,
  now,
  realmMajor,
  battlePower,
  combatPills,
  onRetry,
  onClose,
  onStart,
  onClaim,
}: ExpeditionDrawerProps) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [difficulty, setDifficulty] =
    useState<ExpeditionDifficultyKey>("normal");
  const [durationSec, setDurationSec] = useState<ExpeditionDurationSec>(1800);
  // Phase 3 — 2 slot loadout đan combat; picker đang mở cho slot nào.
  const [loadout, setLoadout] = useState<(string | null)[]>([null, null]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setLoadout([null, null]);
      setPickerSlot(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBranchId((previous) => previous ?? branches[0]?.branch.id ?? null);
  }, [open, branches]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedBranch = useMemo(
    () => branches.find((item) => item.branch.id === branchId) ?? branches[0],
    [branches, branchId],
  );
  const selectedDifficulty = selectedBranch?.difficulties.find(
    (item) => item.key === difficulty,
  );
  // Phase 3 — group branch theo tầng (1→3), trong tầng theo basePower tăng dần.
  const tierGroups = useMemo(() => {
    const groups = new Map<number, ExpeditionBranchDTO[]>();
    for (const item of branches) {
      const list = groups.get(item.branch.tier) ?? [];
      list.push(item);
      groups.set(item.branch.tier, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.branch.basePower - b.branch.basePower);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [branches]);

  const mode = current ? expeditionUiMode(current, now) : "available";
  const ticketCost = formatExpeditionTicketCost(durationSec);
  const selectedLocked = selectedBranch
    ? realmMajor < selectedBranch.branch.minRealmMajor
    : false;
  const canStart =
    !busy &&
    !selectedLocked &&
    Boolean(selectedBranch && selectedDifficulty && current) &&
    canStartExpedition(current, ticketCost);

  const underPower =
    Boolean(selectedBranch) &&
    !selectedLocked &&
    (selectedBranch?.branch.recommendedPower ?? 0) > battlePower;

  if (!open) return null;

  const handleStart = () => {
    if (!canStart || !selectedBranch) return;
    const loadoutPillIds = loadout.filter((id): id is string => id !== null);
    onStart({
      branchId: selectedBranch.branch.id,
      difficulty,
      durationSec,
      ...(loadoutPillIds.length > 0 ? { loadoutPillIds } : {}),
    });
  };

  const pickPill = (slot: number, pillId: string | null) => {
    setLoadout((prev) => {
      const next = [...prev];
      next[slot] = pillId;
      return next;
    });
    setPickerSlot(null);
  };

  return (
    <div className="expedition-overlay">
      <button
        type="button"
        className="expedition-backdrop"
        aria-label="Đóng bí cảnh"
        onClick={onClose}
      />
      <section
        className="expedition-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expedition-drawer-title"
      >
        <header className="expedition-drawer-header">
          <div>
            <p className="expedition-kicker">TÀI NGUYÊN TU HÀNH</p>
            <h2 id="expedition-drawer-title">Bí Cảnh</h2>
          </div>
          <button type="button" className="expedition-close" onClick={onClose}>
            Đóng
          </button>
        </header>

        {error ? (
          <div className="expedition-drawer-error">
            <p>{error}</p>
            <button type="button" className="expedition-btn" onClick={onRetry}>
              Thử lại
            </button>
          </div>
        ) : loading && branches.length === 0 ? (
          <p className="expedition-empty">Đang tải bản đồ bí cảnh...</p>
        ) : mode !== "available" && current?.expedition ? (
          <CurrentExpeditionView
            current={current}
            mode={mode}
            now={now}
            busy={busy}
            onClaim={onClaim}
          />
        ) : (
          <>
            <div className="expedition-quota">
              <span>Điểm vé còn lại</span>
              <strong>{current?.remainingUnits ?? 0} / 12</strong>
            </div>

            <div className="expedition-drawer-section">
              <div className="expedition-section-heading">
                <span>01</span>
                <h3>Chọn nhánh bí cảnh</h3>
              </div>
              <div className="expedition-branch-list">
                {tierGroups.map(([tier, items]) => (
                  <div key={tier} className="expedition-tier-group">
                    <p className="expedition-tier-heading">
                      Tầng {tier} · {TIER_LABELS[tier] ?? ""}
                      {items[0]?.branch.minRealmMajor
                        ? ` · Yêu cầu ${getRealmMeta(items[0].branch.minRealmMajor).name}`
                        : ""}
                    </p>
                    {items.map((item) => {
                      const locked = realmMajor < item.branch.minRealmMajor;
                      return (
                        <button
                          type="button"
                          key={item.branch.id}
                          className={`expedition-branch-item${selectedBranch?.branch.id === item.branch.id ? " selected" : ""}${locked ? " locked" : ""}`}
                          onClick={() => setBranchId(item.branch.id)}
                        >
                          <span className="expedition-branch-glyph">
                            {locked ? "锁" : item.branch.glyph}
                          </span>
                          <span className="expedition-branch-copy">
                            <strong>{item.branch.name}</strong>
                            <small>{item.branch.description}</small>
                            {locked && (
                              <small className="alchemy-recipe-lock">
                                Cần đạt cảnh giới{" "}
                                {getRealmMeta(item.branch.minRealmMajor).name}
                              </small>
                            )}
                          </span>
                          <span className="expedition-branch-power">
                            {item.branch.basePower} lực
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {selectedBranch && (
              <>
                <div className="expedition-drawer-section">
                  <div className="expedition-section-heading">
                    <span>02</span>
                    <h3>Độ khó</h3>
                  </div>
                  <div className="expedition-choice-grid">
                    {DIFFICULTIES.map((key) => {
                      const item = selectedBranch.difficulties.find(
                        (entry) => entry.key === key,
                      );
                      if (!item) return null;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`expedition-choice${difficulty === key ? " selected" : ""}`}
                          onClick={() => setDifficulty(key)}
                        >
                          <strong>{difficultyLabel(key)}</strong>
                          <small>Địch ×{item.enemyMultiplier}</small>
                          <small>Thưởng ×{item.rewardMultiplier}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="expedition-drawer-section">
                  <div className="expedition-section-heading">
                    <span>03</span>
                    <h3>Thời lượng</h3>
                  </div>
                  <div className="expedition-choice-grid expedition-duration-grid">
                    {DURATIONS.map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={`expedition-choice${durationSec === value ? " selected" : ""}`}
                        onClick={() => setDurationSec(value)}
                      >
                        <strong>{formatExpeditionDuration(value)}</strong>
                        <small>
                          {formatExpeditionTicketCost(value)} điểm vé
                        </small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="expedition-drawer-section">
                  <div className="expedition-section-heading">
                    <span>04</span>
                    <h3>Loadout đan (tối đa 2)</h3>
                  </div>
                  <div className="expedition-loadout-grid">
                    {loadout.map((slotId, slot) => {
                      const pill = slotId
                        ? combatPills.find((p) => p.id === slotId)
                        : undefined;
                      return (
                        <div
                          key={slotId ?? `slot-${slot}`}
                          className="expedition-loadout-slot"
                        >
                          {pill ? (
                            <>
                              <span className="expedition-loadout-glyph">
                                {pill.glyph}
                              </span>
                              <span className="expedition-loadout-copy">
                                <strong>{pill.name}</strong>
                                <small>×{pill.quantity} trong đan phòng</small>
                              </span>
                              <button
                                type="button"
                                className="expedition-loadout-remove"
                                onClick={() => pickPill(slot, null)}
                                aria-label={`Bỏ ${pill.name}`}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="expedition-loadout-add"
                              onClick={() =>
                                setPickerSlot(pickerSlot === slot ? null : slot)
                              }
                            >
                              ＋ Chọn đan combat
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {pickerSlot !== null && (
                    <div className="expedition-loadout-picker">
                      {combatPills.filter(
                        (p) => p.quantity > 0 && !loadout.includes(p.id),
                      ).length === 0 ? (
                        <p className="expedition-hint">
                          Đan phòng chưa có đan combat — luyện qua công thức
                          Linh Giai (Đan Sư cấp 4).
                        </p>
                      ) : (
                        combatPills
                          .filter(
                            (p) => p.quantity > 0 && !loadout.includes(p.id),
                          )
                          .map((pill) => (
                            <button
                              type="button"
                              key={pill.id}
                              className="expedition-loadout-option"
                              onClick={() => pickPill(pickerSlot, pill.id)}
                            >
                              <span className="expedition-loadout-glyph">
                                {pill.glyph}
                              </span>
                              <span className="expedition-loadout-copy">
                                <strong>{pill.name}</strong>
                                <small>
                                  ×{pill.quantity} · {pill.desc}
                                </small>
                              </span>
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {underPower && selectedBranch && (
                  <p className="expedition-power-warn">
                    ⚠ Chiến lực khuyến nghị{" "}
                    {selectedBranch.branch.recommendedPower} (hiện tại{" "}
                    {battlePower}) — chuyến đi vẫn khả dụng nhưng rủi ro cao.
                  </p>
                )}

                <div className="expedition-reward-preview">
                  <div>
                    <span className="stat-label">Phần thưởng dự kiến</span>
                    <strong>
                      {rewardPercentForWins(3)}% khi thắng đủ 3 trận
                    </strong>
                  </div>
                  <span className="expedition-reward-note">
                    {selectedDifficulty
                      ? `Tỷ lệ rơi boss ${(selectedDifficulty.bossDropRate * 100).toFixed(0)}%`
                      : "Chọn độ khó"}
                  </span>
                </div>
                <button
                  type="button"
                  className="expedition-btn expedition-btn-primary expedition-start-btn"
                  disabled={!canStart}
                  onClick={handleStart}
                >
                  {busy
                    ? "Đang khởi hành..."
                    : `Khởi hành · ${ticketCost} điểm vé`}
                </button>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CurrentExpeditionView({
  current,
  mode,
  now,
  busy,
  onClaim,
}: {
  current: CurrentExpeditionDTO;
  mode: "running" | "claimable";
  now: Date;
  busy: boolean;
  onClaim: () => void;
}) {
  const expedition = current.expedition;
  if (!expedition) return null;
  const remaining = secondsRemaining(expedition.completesAt, now);
  return (
    <div className="expedition-active-view">
      <div className="expedition-active-orb">
        {mode === "running" ? "行" : "賞"}
      </div>
      <p className="expedition-kicker">CHUYẾN ĐI HIỆN TẠI</p>
      <h3>{expedition.branchId}</h3>
      <p className="expedition-active-meta">
        {difficultyLabel(expedition.difficulty)} ·{" "}
        {formatExpeditionDuration(expedition.durationSec)}
      </p>
      {mode === "running" ? (
        <>
          <strong className="expedition-active-countdown">
            {formatLongCountdown(remaining)}
          </strong>
          <p className="expedition-hint">
            Bí cảnh sẽ tự hoàn tất offline. Quay lại sau để nhận thưởng.
          </p>
        </>
      ) : (
        <>
          <strong className="expedition-active-countdown expedition-countdown-ready">
            Đã hoàn tất
          </strong>
          <p className="expedition-hint">
            Nhận thưởng để giải phóng ô bí cảnh.
          </p>
          <button
            type="button"
            className="expedition-btn expedition-btn-primary"
            disabled={busy}
            onClick={onClaim}
          >
            {busy ? "Đang nhận..." : "Nhận phần thưởng"}
          </button>
        </>
      )}
    </div>
  );
}

function difficultyLabel(key: ExpeditionDifficultyKey): string {
  return key === "easy" ? "Dễ" : key === "normal" ? "Thường" : "Khó";
}

function formatLongCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
