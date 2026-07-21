"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import {
  createAdminCode,
  fetchAdminCodes,
  fetchAdminPills,
  updateAdminCode,
} from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import { findRedeemError, validateRedeemDraft } from "@/lib/redeem-validation";
import type { AdminPillDTO, AdminRedeemCodeDTO } from "@/lib/types";

type CodeDraft = Omit<AdminRedeemCodeDTO, "redeemedCount">;

// The single blocking reason a player would hit, in precedence order: an admin
// switch-off wins over a passed expiry wins over a hit cap; otherwise live.
type CodeStatus = "off" | "expired" | "exhausted" | "active";

const STATUS_LABEL: Record<CodeStatus, string> = {
  off: "Đã tắt",
  expired: "Hết hạn",
  exhausted: "Hết lượt",
  active: "Hoạt động",
};

function codeStatus(code: AdminRedeemCodeDTO, now: number): CodeStatus {
  if (!code.active) return "off";
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= now)
    return "expired";
  if (code.redeemedCount >= code.maxRedemptions) return "exhausted";
  return "active";
}

// Fraction of the redemption cap consumed, clamped to [0, 1] for the gauge.
function redeemedFraction(code: AdminRedeemCodeDTO): number {
  if (code.maxRedemptions <= 0) return 1;
  return Math.min(1, code.redeemedCount / code.maxRedemptions);
}

// Gauge fill colour follows status: gold once exhausted, dim when off/expired,
// jade while healthy — same taxonomy as the status pill.
function meterClass(status: CodeStatus): string {
  if (status === "exhausted") return "exhausted";
  if (status === "off" || status === "expired") return "dim";
  return "";
}

// Small caps read as a countable tally; above this a continuous bar is clearer.
const MAX_PIPS = 12;

// The redemption capacity as a punch-voucher tally: one pip per redemption slot,
// each consumed slot filled. Caps above MAX_PIPS fall back to a smooth bar so
// the metaphor never degrades into an unreadable row of hairlines.
function CapacityGauge({
  code,
  status,
  size,
}: {
  code: AdminRedeemCodeDTO;
  status: CodeStatus;
  size: "sm" | "lg";
}) {
  const tone = meterClass(status);
  const { redeemedCount, maxRedemptions } = code;
  if (maxRedemptions >= 1 && maxRedemptions <= MAX_PIPS) {
    const filled = Math.min(redeemedCount, maxRedemptions);
    return (
      <div className={`admin-code-pips admin-code-pips--${size}`} aria-hidden>
        {Array.from({ length: maxRedemptions }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional slots
            key={i}
            className={`admin-code-pip${i < filled ? ` filled ${tone}` : ""}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div className={`admin-code-meter admin-code-meter--${size}`} aria-hidden>
      <div
        className={`admin-code-meter-fill ${tone}`}
        style={{ width: `${redeemedFraction(code) * 100}%` }}
      />
    </div>
  );
}

function emptyCode(): CodeDraft {
  return {
    id: "",
    code: "",
    active: true,
    maxRedemptions: 1,
    expiresAt: null,
    rewards: [],
  };
}

// ISO string ↔ <input type="datetime-local"> value (local, no seconds/zone).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CodeFormProps {
  initial: CodeDraft;
  isNew: boolean;
  pills: AdminPillDTO[];
  onSaved: (saved: AdminRedeemCodeDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CodeForm({
  initial,
  isNew,
  pills,
  onSaved,
  onCancel,
  onDirtyChange,
}: CodeFormProps) {
  const [draft, setDraft] = useState<CodeDraft>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(
    () => validateRedeemDraft(draft, { isNew }),
    [draft, isNew],
  );
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof CodeDraft>(key: K, value: CodeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setReward = (
    idx: number,
    patch: Partial<{ pillId: string; quantity: number }>,
  ) =>
    setDraft((d) => ({
      ...d,
      rewards: d.rewards.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const addReward = () =>
    setDraft((d) => ({
      ...d,
      rewards: [...d.rewards, { pillId: "", quantity: 1 }],
    }));

  const removeReward = (idx: number) =>
    setDraft((d) => ({ ...d, rewards: d.rewards.filter((_, i) => i !== idx) }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = isNew
        ? await createAdminCode(draft)
        : await updateAdminCode(draft.id, {
            active: draft.active,
            maxRedemptions: draft.maxRedemptions,
            expiresAt: draft.expiresAt,
            rewards: draft.rewards,
          });
      onSaved(saved);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  // Empty numeric input becomes NaN, which validation flags — never silent 0.
  const numericValue = (v: number) => (Number.isNaN(v) ? "" : v);
  const rewardsError = findRedeemError(errors, "rewards");

  const idError = findRedeemError(errors, "id");
  const codeError = findRedeemError(errors, "code");
  const maxError = findRedeemError(errors, "maxRedemptions");

  return (
    <div className="admin-code-form">
      {/* Section 1 — identity + limits. Grouped and titled so the form reads as
          discrete blocks rather than one undifferentiated grid. */}
      <section className="admin-code-section">
        <div className="admin-code-section-head">
          <h4 className="admin-code-section-title">Thông tin cơ bản</h4>
        </div>
        <div className="admin-code-form-grid">
          {isNew && (
            <label className="admin-code-field">
              <span className="admin-code-label">
                ID <span className="admin-req">*</span>
              </span>
              <input
                className={`admin-input${idError ? " invalid" : ""}`}
                value={draft.id}
                onChange={(e) => set("id", e.target.value)}
                aria-label="ID mã"
                placeholder="tan-thu-2026"
              />
              <span className="admin-code-hint">
                Định danh nội bộ, không đổi được sau khi tạo
              </span>
              {idError && (
                <span className="admin-field-error">{idError.message}</span>
              )}
            </label>
          )}
          {isNew && (
            <label className="admin-code-field">
              <span className="admin-code-label">
                Mã code <span className="admin-req">*</span>
              </span>
              <input
                className={`admin-input${codeError ? " invalid" : ""}`}
                value={draft.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                aria-label="Mã code"
                placeholder="TANTHU2026"
              />
              <span className="admin-code-hint">
                Người chơi nhập để đổi (không phân biệt hoa/thường)
              </span>
              {codeError && (
                <span className="admin-field-error">{codeError.message}</span>
              )}
            </label>
          )}
          <label className="admin-code-field">
            <span className="admin-code-label">
              Tổng lượt đổi tối đa <span className="admin-req">*</span>
            </span>
            <input
              type="number"
              className={`admin-input${maxError ? " invalid" : ""}`}
              value={numericValue(draft.maxRedemptions)}
              onChange={(e) =>
                set(
                  "maxRedemptions",
                  e.target.value === "" ? Number.NaN : Number(e.target.value),
                )
              }
              aria-label="Tổng lượt đổi tối đa"
            />
            {maxError && (
              <span className="admin-field-error">{maxError.message}</span>
            )}
          </label>
          <label className="admin-code-field">
            <span className="admin-code-label">Hết hạn</span>
            <input
              type="datetime-local"
              className="admin-input"
              value={isoToLocalInput(draft.expiresAt)}
              onChange={(e) =>
                set(
                  "expiresAt",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                )
              }
              aria-label="Thời điểm hết hạn"
            />
            <span className="admin-code-hint">Trống = không hết hạn</span>
          </label>
        </div>

        {/* Active state as a switch, not a bare checkbox — reads as a live
            on/off control matching the status pill in the header. */}
        <label className="admin-code-toggle">
          <input
            type="checkbox"
            className="admin-code-toggle-input"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          <span className="admin-code-switch" aria-hidden="true" />
          <span className="admin-code-toggle-text">
            <span className="admin-code-toggle-title">Kích hoạt</span>
            <span className="admin-code-hint">
              Tắt để tạm chặn người chơi đổi mã (giữ nguyên số lượt đã đổi)
            </span>
          </span>
        </label>
      </section>

      {/* Section 2 — rewards. */}
      <section className="admin-code-section">
        <div className="admin-code-section-head">
          <h4 className="admin-code-section-title">Phần thưởng</h4>
          <span className="admin-code-section-hint">
            Đan dược trao khi đổi mã
          </span>
        </div>
        {rewardsError && (
          <p className="admin-field-error">{rewardsError.message}</p>
        )}
        {draft.rewards.length === 0 && !rewardsError && (
          <p className="admin-code-rewards-empty">
            Chưa có phần thưởng. Thêm ít nhất một đan dược để mã có hiệu lực.
          </p>
        )}
        <div className="admin-code-reward-list">
          {draft.rewards.map((r, i) => {
            const selected = pills.find((p) => p.id === r.pillId);
            const glyphColor = selected
              ? getRarityMeta(selected.rarity).color
              : "var(--muted)";
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, no stable id
                key={i}
                className="admin-code-reward-row"
              >
                <span
                  className="admin-code-reward-glyph"
                  style={{ color: glyphColor }}
                  aria-hidden="true"
                >
                  {selected?.glyph ?? "?"}
                </span>
                <select
                  className="admin-input admin-code-reward-select"
                  value={r.pillId}
                  aria-label={`Đan dược hàng ${i + 1}`}
                  onChange={(e) => setReward(i, { pillId: e.target.value })}
                >
                  <option value="">-- Chọn đan dược --</option>
                  {pills.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="admin-code-reward-qty-wrap">
                  <span className="admin-code-reward-times" aria-hidden="true">
                    ×
                  </span>
                  <input
                    type="number"
                    className="admin-input admin-code-reward-qty"
                    min={1}
                    aria-label={`Số lượng hàng ${i + 1}`}
                    value={numericValue(r.quantity)}
                    onChange={(e) =>
                      setReward(i, {
                        quantity:
                          e.target.value === ""
                            ? Number.NaN
                            : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn admin-code-reward-remove"
                  aria-label={`Xóa hàng ${i + 1}`}
                  onClick={() => removeReward(i)}
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="admin-btn admin-code-add-reward"
          onClick={addReward}
        >
          + Thêm đan dược
        </button>
      </section>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-code-form-footer">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={saving || errors.length > 0 || (!dirty && !isNew)}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={saving}
        >
          {dirty ? "Hoàn tác" : "Đóng"}
        </button>
      </div>
    </div>
  );
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AdminRedeemCodeDTO[] | null>(null);
  const [pills, setPills] = useState<AdminPillDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [{ codes: list }, { pills: pillList }] = await Promise.all([
        fetchAdminCodes(),
        fetchAdminPills(),
      ]);
      setCodes(list);
      setPills(pillList);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được danh sách");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!dirtyOpen) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyOpen]);

  const requestOpen = (next: string | null) => {
    if (
      dirtyOpen &&
      !window.confirm("Biểu mẫu đang mở có thay đổi chưa lưu. Bỏ thay đổi?")
    ) {
      return;
    }
    setOpenId(next);
  };

  const onSaved = (saved: AdminRedeemCodeDTO) => {
    setCodes((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      return prev.map((c) => (c.id === saved.id ? saved : c));
    });
    setOpenId(null);
  };

  if (loadError) {
    return (
      <div>
        <p className="admin-error">{loadError}</p>
        <button type="button" className="admin-btn" onClick={load}>
          Thử lại
        </button>
      </div>
    );
  }
  if (codes === null) {
    return <p>Đang tải…</p>;
  }

  const editingCode =
    openId && openId !== "new" ? codes.find((c) => c.id === openId) : null;
  const isEditing = openId !== null;
  // One "now" per render so every row's expiry check is consistent.
  const now = Date.now();
  const editingStatus = editingCode ? codeStatus(editingCode, now) : null;

  return (
    <section>
      <div className="admin-topbar">
        <h2>Redeem Code ({codes.length})</h2>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => requestOpen("new")}
          disabled={openId === "new"}
        >
          + Tạo mã mới
        </button>
      </div>

      <div className="admin-code-layout">
        {/* Master: one voucher row per code — code + status, capacity gauge,
            then counts + expiry. */}
        <div className="admin-code-list">
          {codes.length === 0 && (
            <p className="admin-code-list-empty">
              Chưa có mã nào. Tạo mã đầu tiên để phát thưởng.
            </p>
          )}
          {codes.map((code) => {
            const status = codeStatus(code, now);
            return (
              <button
                key={code.id}
                type="button"
                className={`admin-code-row${status === "active" ? "" : " inactive"}`}
                aria-current={openId === code.id}
                onClick={() => requestOpen(openId === code.id ? null : code.id)}
              >
                <div className="admin-code-row-top">
                  <span className="admin-code-string">{code.code}</span>
                  <span
                    className={`admin-code-status admin-code-status--${status}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <CapacityGauge code={code} status={status} size="sm" />
                <div className="admin-code-row-foot">
                  <span className="admin-num">
                    {code.redeemedCount}/{code.maxRedemptions} lượt
                  </span>
                  <span>
                    {code.expiresAt
                      ? `HSD ${new Date(code.expiresAt).toLocaleDateString("vi-VN")}`
                      : "Không hết hạn"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail: voucher header + editor for the selected code, or a prompt. */}
        <div
          className={`admin-code-detail${
            editingStatus ? ` admin-code-detail--${editingStatus}` : ""
          }`}
        >
          {isEditing ? (
            <>
              <div className="admin-code-detail-head">
                {openId === "new" ? (
                  <h3 className="admin-code-detail-title">Tạo mã mới</h3>
                ) : editingCode && editingStatus ? (
                  <>
                    <div className="admin-code-detail-id">
                      <span className="admin-code-string admin-code-string--lg">
                        {editingCode.code}
                      </span>
                      <span
                        className={`admin-code-status admin-code-status--${editingStatus}`}
                      >
                        {STATUS_LABEL[editingStatus]}
                      </span>
                    </div>
                    <div className="admin-code-gauge">
                      <CapacityGauge
                        code={editingCode}
                        status={editingStatus}
                        size="lg"
                      />
                      <span className="admin-code-gauge-label">
                        <span className="admin-num">
                          {editingCode.redeemedCount}/
                          {editingCode.maxRedemptions}
                        </span>{" "}
                        lượt đã đổi
                        {editingCode.expiresAt
                          ? ` · Hết hạn ${new Date(editingCode.expiresAt).toLocaleString("vi-VN")}`
                          : " · Không hết hạn"}
                      </span>
                    </div>
                  </>
                ) : (
                  <h3 className="admin-code-detail-title">(không rõ)</h3>
                )}
              </div>
              <CodeForm
                key={openId}
                initial={
                  openId === "new"
                    ? emptyCode()
                    : {
                        id: editingCode?.id ?? "",
                        code: editingCode?.code ?? "",
                        active: editingCode?.active ?? true,
                        maxRedemptions: editingCode?.maxRedemptions ?? 1,
                        expiresAt: editingCode?.expiresAt ?? null,
                        rewards: editingCode?.rewards ?? [],
                      }
                }
                isNew={openId === "new"}
                pills={pills}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-code-detail-empty">
              <p>Chọn một mã để chỉnh sửa, hoặc tạo mã mới.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
