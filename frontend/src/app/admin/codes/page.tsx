"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import {
  createAdminCode,
  fetchAdminCodes,
  fetchAdminCongPhap,
  fetchAdminMaterials,
  fetchAdminPills,
  updateAdminCode,
} from "@/lib/api";
import { getCongPhapRarityMeta } from "@/lib/congphap-display";
import { getRarityMeta } from "@/lib/pill-constants";
import { findRedeemError, validateRedeemDraft } from "@/lib/redeem-validation";
import type {
  AdminPillDTO,
  AdminRedeemCodeDTO,
  AdminRedeemRewardDTO,
  CongPhapDTO,
  MaterialDTO,
} from "@/lib/types";

type CodeDraft = Omit<AdminRedeemCodeDTO, "redeemedCount">;

// A reward carries exactly one kind; the selector below rewrites the row
// wholesale when the kind changes so a stale key can never linger and trip the
// backend's "exactly one" rule.
type RewardKind = "pill" | "congphap" | "linhThach" | "material";

const REWARD_KIND_LABEL: Record<RewardKind, string> = {
  pill: "Đan dược",
  congphap: "Công pháp",
  linhThach: "Linh Thạch",
  material: "Vật phẩm",
};

function rewardKind(r: AdminRedeemRewardDTO): RewardKind {
  if (r.congPhapId !== undefined) return "congphap";
  if (r.linhThach !== undefined) return "linhThach";
  if (r.materialId !== undefined) return "material";
  return "pill";
}

function emptyRewardOfKind(
  kind: RewardKind,
  quantity: number,
): AdminRedeemRewardDTO {
  if (kind === "congphap") return { congPhapId: "", quantity };
  if (kind === "linhThach") return { linhThach: 100, quantity: 1 };
  if (kind === "material") return { materialId: "", quantity };
  return { pillId: "", quantity };
}

// The single blocking reason a player would hit, in precedence order: an admin
// switch-off wins over a passed expiry wins over a hit cap; otherwise live.
type CodeStatus = "off" | "expired" | "exhausted" | "active";

const STATUS_LABEL: Record<CodeStatus, string> = {
  off: "Đã tắt",
  expired: "Hết hạn",
  exhausted: "Hết lượt",
  active: "Hoạt động",
};

// Bốn trạng thái của mã ánh xạ vào bốn sắc thái trung tính dùng chung cho mọi
// trang admin. CSS chỉ biết ok/warn/danger/off, không biết "hết hạn" là gì.
type Tone = "ok" | "warn" | "danger" | "off";

const STATUS_TONE: Record<CodeStatus, Tone> = {
  active: "ok",
  exhausted: "warn",
  expired: "danger",
  off: "off",
};

// Màu viền trên khung chi tiết, đặt qua biến --detail-tone.
const TONE_COLOR: Record<Tone, string> = {
  ok: "var(--jade)",
  warn: "var(--gold)",
  danger: "var(--red)",
  off: "var(--muted-dim)",
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

// Màu gauge theo trạng thái: vàng khi hết lượt, xám khi tắt/hết hạn, ngọc khi
// còn khỏe — cùng bảng sắc thái với nhãn trạng thái.
function meterClass(status: CodeStatus): string {
  if (status === "exhausted") return "warn";
  if (status === "off" || status === "expired") return "off";
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
      <div className={`admin-pips admin-pips--${size}`} aria-hidden>
        {Array.from({ length: maxRedemptions }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional slots
            key={i}
            className={`admin-pip${i < filled ? ` filled ${tone}` : ""}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div className={`admin-meter admin-meter--${size}`} aria-hidden>
      <div
        className={`admin-meter-fill ${tone}`}
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
  congphap: CongPhapDTO[];
  materials: MaterialDTO[];
  onSaved: (saved: AdminRedeemCodeDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CodeForm({
  initial,
  isNew,
  pills,
  congphap,
  materials,
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

  const setReward = (idx: number, patch: Partial<AdminRedeemRewardDTO>) =>
    setDraft((d) => ({
      ...d,
      rewards: d.rewards.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  // Replace (not merge) so the previous kind's key disappears entirely.
  const setRewardKind = (idx: number, kind: RewardKind) =>
    setDraft((d) => ({
      ...d,
      rewards: d.rewards.map((r, i) =>
        i === idx ? emptyRewardOfKind(kind, r.quantity) : r,
      ),
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
    <div className="admin-form">
      {/* Section 1 — identity + limits. Grouped and titled so the form reads as
          discrete blocks rather than one undifferentiated grid. */}
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Thông tin cơ bản</h4>
        </div>
        <div className="admin-form-grid">
          {isNew && (
            <label className="admin-field">
              <span className="admin-field-label">
                ID <span className="admin-req">*</span>
              </span>
              <input
                className={`admin-input${idError ? " invalid" : ""}`}
                value={draft.id}
                onChange={(e) => set("id", e.target.value)}
                aria-label="ID mã"
                placeholder="tan-thu-2026"
              />
              <span className="admin-field-hint">
                Định danh nội bộ, không đổi được sau khi tạo
              </span>
              {idError && (
                <span className="admin-field-error">{idError.message}</span>
              )}
            </label>
          )}
          {isNew && (
            <label className="admin-field">
              <span className="admin-field-label">
                Mã code <span className="admin-req">*</span>
              </span>
              <input
                className={`admin-input${codeError ? " invalid" : ""}`}
                value={draft.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                aria-label="Mã code"
                placeholder="TANTHU2026"
              />
              <span className="admin-field-hint">
                Người chơi nhập để đổi (không phân biệt hoa/thường)
              </span>
              {codeError && (
                <span className="admin-field-error">{codeError.message}</span>
              )}
            </label>
          )}
          <label className="admin-field">
            <span className="admin-field-label">
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
          <label className="admin-field">
            <span className="admin-field-label">Hết hạn</span>
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
            <span className="admin-field-hint">Trống = không hết hạn</span>
          </label>
        </div>

        {/* Active state as a switch, not a bare checkbox — reads as a live
            on/off control matching the status pill in the header. */}
        <label className="admin-switch">
          <input
            type="checkbox"
            className="admin-switch-input"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          <span className="admin-switch-track" aria-hidden="true" />
          <span className="admin-switch-text">
            <span className="admin-switch-title">Kích hoạt</span>
            <span className="admin-field-hint">
              Tắt để tạm chặn người chơi đổi mã (giữ nguyên số lượt đã đổi)
            </span>
          </span>
        </label>
      </section>

      {/* Section 2 — rewards. */}
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Phần thưởng</h4>
          <span className="admin-form-section-hint">
            Đan dược, công pháp hoặc Linh Thạch trao khi đổi mã
          </span>
        </div>
        {rewardsError && (
          <p className="admin-field-error">{rewardsError.message}</p>
        )}
        {draft.rewards.length === 0 && !rewardsError && (
          <p className="admin-row-empty">
            Chưa có phần thưởng. Thêm ít nhất một phần thưởng để mã có hiệu lực.
          </p>
        )}
        <div className="admin-row-list">
          {draft.rewards.map((r, i) => {
            const kind = rewardKind(r);
            const selectedPill = pills.find((p) => p.id === r.pillId);
            const selectedCongPhap = congphap.find(
              (cp) => cp.id === r.congPhapId,
            );
            const glyph =
              kind === "linhThach"
                ? "晶"
                : kind === "congphap"
                  ? (selectedCongPhap?.glyph ?? "?")
                  : kind === "material"
                    ? "材"
                    : (selectedPill?.glyph ?? "?");
            const glyphColor =
              kind === "linhThach"
                ? "var(--jade)"
                : kind === "congphap"
                  ? selectedCongPhap
                    ? getCongPhapRarityMeta(selectedCongPhap.rarity).color
                    : "var(--muted)"
                  : kind === "material"
                    ? "var(--gold)"
                    : selectedPill
                      ? getRarityMeta(selectedPill.rarity).color
                      : "var(--muted)";
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, no stable id
                key={i}
                className="admin-row"
              >
                <span
                  className="admin-row-glyph"
                  style={{ color: glyphColor }}
                  aria-hidden="true"
                >
                  {glyph}
                </span>
                <select
                  className="admin-input admin-code-reward-kind"
                  value={kind}
                  aria-label={`Loại phần thưởng hàng ${i + 1}`}
                  onChange={(e) =>
                    setRewardKind(i, e.target.value as RewardKind)
                  }
                >
                  {(Object.keys(REWARD_KIND_LABEL) as RewardKind[]).map((k) => (
                    <option key={k} value={k}>
                      {REWARD_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                {kind === "pill" && (
                  <select
                    className="admin-input admin-row-grow"
                    value={r.pillId ?? ""}
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
                )}
                {kind === "congphap" && (
                  <select
                    className="admin-input admin-row-grow"
                    value={r.congPhapId ?? ""}
                    aria-label={`Công pháp hàng ${i + 1}`}
                    onChange={(e) =>
                      setReward(i, { congPhapId: e.target.value })
                    }
                  >
                    <option value="">-- Chọn công pháp --</option>
                    {congphap.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                )}
                {kind === "material" && (
                  <select
                    className="admin-input admin-row-grow"
                    value={r.materialId ?? ""}
                    aria-label={`Vật phẩm hàng ${i + 1}`}
                    onChange={(e) =>
                      setReward(i, { materialId: e.target.value })
                    }
                  >
                    <option value="">-- Chọn vật phẩm --</option>
                    {[...materials]
                      .sort((a, b) =>
                        a.id.startsWith("bi-tich-") ===
                        b.id.startsWith("bi-tich-")
                          ? a.name.localeCompare(b.name)
                          : a.id.startsWith("bi-tich-")
                            ? -1
                            : 1,
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.glyph} {m.name}
                        </option>
                      ))}
                  </select>
                )}
                {kind === "linhThach" && (
                  <input
                    type="number"
                    className="admin-input admin-row-grow"
                    min={1}
                    aria-label={`Số Linh Thạch hàng ${i + 1}`}
                    value={numericValue(r.linhThach ?? Number.NaN)}
                    onChange={(e) =>
                      setReward(i, {
                        linhThach:
                          e.target.value === ""
                            ? Number.NaN
                            : Number(e.target.value),
                      })
                    }
                  />
                )}
                {/* A Linh Thạch reward carries its amount in the field above,
                    so the ×N multiplier would be a second, contradictory
                    number — render it only for the item kinds. (An `hidden`
                    attribute would do nothing here: this class sets
                    `display: flex`, which outranks the UA stylesheet's
                    `[hidden] { display: none }`.) */}
                {kind !== "linhThach" && (
                  <div className="admin-code-reward-qty-wrap">
                    <span
                      className="admin-code-reward-times"
                      aria-hidden="true"
                    >
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
                )}
                <button
                  type="button"
                  className="admin-btn admin-row-remove"
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
          className="admin-btn admin-row-add"
          onClick={addReward}
        >
          + Thêm đan dược
        </button>
      </section>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-form-footer">
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
  const [congphap, setCongPhap] = useState<CongPhapDTO[]>([]);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [
        { codes: list },
        { pills: pillList },
        { congphap: cpList },
        { materials: materialList },
      ] = await Promise.all([
        fetchAdminCodes(),
        fetchAdminPills(),
        fetchAdminCongPhap(),
        fetchAdminMaterials(),
      ]);
      setCodes(list);
      setPills(pillList);
      setCongPhap(cpList);
      setMaterials(materialList);
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

      <div className="admin-master-detail">
        {/* Master: one voucher row per code — code + status, capacity gauge,
            then counts + expiry. */}
        <div className="admin-master-list">
          {codes.length === 0 && (
            <p className="admin-master-empty">
              Chưa có mã nào. Tạo mã đầu tiên để phát thưởng.
            </p>
          )}
          {codes.map((code) => {
            const status = codeStatus(code, now);
            return (
              <button
                key={code.id}
                type="button"
                className={`admin-master-item${status === "active" ? "" : " inactive"}`}
                aria-current={openId === code.id}
                onClick={() => requestOpen(openId === code.id ? null : code.id)}
              >
                <div className="admin-master-item-top">
                  <span className="admin-code-string">{code.code}</span>
                  <span
                    className={`admin-status admin-status--${STATUS_TONE[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <CapacityGauge code={code} status={status} size="sm" />
                <div className="admin-master-item-foot">
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
          className="admin-detail"
          style={
            editingStatus
              ? ({
                  "--detail-tone": TONE_COLOR[STATUS_TONE[editingStatus]],
                } as CSSProperties)
              : undefined
          }
        >
          {isEditing ? (
            <>
              <div className="admin-detail-head">
                {openId === "new" ? (
                  <h3 className="admin-detail-title">Tạo mã mới</h3>
                ) : editingCode && editingStatus ? (
                  <>
                    <div className="admin-detail-id">
                      <span className="admin-code-string admin-code-string--lg">
                        {editingCode.code}
                      </span>
                      <span
                        className={`admin-status admin-status--${STATUS_TONE[editingStatus]}`}
                      >
                        {STATUS_LABEL[editingStatus]}
                      </span>
                    </div>
                    <div className="admin-detail-gauge">
                      <CapacityGauge
                        code={editingCode}
                        status={editingStatus}
                        size="lg"
                      />
                      <span className="admin-detail-gauge-label">
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
                  <h3 className="admin-detail-title">(không rõ)</h3>
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
                congphap={congphap}
                materials={materials}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Chọn một mã để chỉnh sửa, hoặc tạo mã mới.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
