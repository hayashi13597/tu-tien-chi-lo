"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RarityPips } from "@/components/rarity-pips";
import { createAdminPill, fetchAdminPills, updateAdminPill } from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import {
  findPillError,
  PILL_KIND_FIELDS,
  validatePillDraft,
} from "@/lib/pill-validation";
import type { AdminPillDTO, PillEffectKind, PillRarity } from "@/lib/types";

const EFFECT_KINDS: { value: PillEffectKind; label: string }[] = [
  { value: "linhKhi", label: "Tăng linh khí" },
  { value: "cultivationBuff", label: "Buff tốc độ tu" },
  { value: "breakthroughBoost", label: "Tăng tỉ lệ đột phá" },
  { value: "clearPunishment", label: "Giải trừng phạt" },
];

const RARITIES: PillRarity[] = [0, 1, 2, 3, 4];

const EFFECT_HINTS: Record<PillEffectKind, string> = {
  linhKhi: "cộng thẳng một lần vào linh khí khi dùng",
  cultivationBuff:
    "nhân tốc độ tu luyện trong một khoảng thời gian; dùng lại thì làm mới, không cộng dồn",
  breakthroughBoost: "cộng tỉ lệ cho lần đột phá kế tiếp, dùng một lần rồi mất",
  clearPunishment: "gỡ trạng thái trọng thương ngay lập tức",
};

// Human label for an effect kind, reusing the select's option list.
function effectLabel(kind: PillEffectKind): string {
  return EFFECT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

// Editable defaults per effect kind. Switching kinds resets the stat fields:
// non-kind fields become null (the backend rejects orphaned values), the new
// kind's fields get a sensible starting point.
function statsForKind(
  kind: PillEffectKind,
): Pick<AdminPillDTO, "amount" | "multiplier" | "durationSec" | "bonusPct"> {
  switch (kind) {
    case "linhKhi":
      return {
        amount: 50,
        multiplier: null,
        durationSec: null,
        bonusPct: null,
      };
    case "cultivationBuff":
      return {
        amount: null,
        multiplier: 1.5,
        durationSec: 60,
        bonusPct: null,
      };
    case "breakthroughBoost":
      return {
        amount: null,
        multiplier: null,
        durationSec: null,
        bonusPct: 10,
      };
    case "clearPunishment":
      return {
        amount: null,
        multiplier: null,
        durationSec: null,
        bonusPct: null,
      };
  }
}

function emptyPill(): AdminPillDTO {
  return {
    id: "",
    name: "",
    glyph: "",
    rarity: 0,
    effectKind: "linhKhi",
    ...statsForKind("linhKhi"),
    desc: "",
    active: true,
    starterQuantity: 0,
  };
}

// One-line effect summary for the collapsed card.
function headlineStat(pill: AdminPillDTO): string {
  switch (pill.effectKind) {
    case "linhKhi":
      return `+${pill.amount ?? "?"} linh khí`;
    case "cultivationBuff":
      return `×${pill.multiplier ?? "?"} trong ${pill.durationSec ?? "?"}s`;
    case "breakthroughBoost":
      return `+${pill.bonusPct ?? "?"}% đột phá`;
    case "clearPunishment":
      return "Giải trừng phạt";
  }
}

const STAT_LABELS: Record<
  "amount" | "multiplier" | "durationSec" | "bonusPct",
  string
> = {
  amount: "Linh khí cộng",
  multiplier: "Hệ số tốc độ",
  durationSec: "Thời gian (giây)",
  bonusPct: "Cộng tỉ lệ (%)",
};

interface PillFormProps {
  initial: AdminPillDTO;
  isNew: boolean;
  onSaved: (saved: AdminPillDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function PillForm({
  initial,
  isNew,
  onSaved,
  onCancel,
  onDirtyChange,
}: PillFormProps) {
  const [draft, setDraft] = useState<AdminPillDTO>(() =>
    structuredClone(initial),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(
    () => validatePillDraft(draft, { isNew }),
    [draft, isNew],
  );
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  useEffect(() => {
    onDirtyChange(dirty);
    // Leaving the form (unmount) means the draft is gone — no longer dirty.
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof AdminPillDTO>(key: K, value: AdminPillDTO[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setKind = (kind: PillEffectKind) =>
    setDraft((d) => ({ ...d, effectKind: kind, ...statsForKind(kind) }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = isNew
        ? await createAdminPill(draft)
        : await updateAdminPill(
            draft.id,
            (({ id: _id, ...body }) => body)(draft),
          );
      onSaved(saved);
    } catch (e) {
      // Keep the draft; surface the server's message (e.g. PILL_ID_TAKEN).
      setSaveError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  // Numeric input helper: empty string becomes NaN, which validation flags —
  // never silently 0 (same convention as the realms editor).
  const numericValue = (v: number | null) =>
    v === null || Number.isNaN(v) ? "" : v;

  const idError = findPillError(errors, "id");
  const statFields = PILL_KIND_FIELDS[draft.effectKind];

  return (
    <div className="admin-form">
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Nhận dạng</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">ID</span>
            <input
              className={`admin-input${idError ? " invalid" : ""}`}
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              readOnly={!isNew}
              disabled={saving}
              aria-label="ID đan dược"
            />
            <span className="admin-field-hint">
              Định danh nội bộ, không đổi được sau khi tạo
            </span>
            {idError && (
              <span className="admin-field-error">{idError.message}</span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Tên</span>
            <input
              className={`admin-input${findPillError(errors, "name") ? " invalid" : ""}`}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={saving}
              aria-label="Tên đan dược"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Glyph</span>
            <input
              className={`admin-input${findPillError(errors, "glyph") ? " invalid" : ""}`}
              value={draft.glyph}
              onChange={(e) => set("glyph", e.target.value)}
              disabled={saving}
              aria-label="Glyph đan dược"
            />
            <span className="admin-field-hint">
              Một ký tự Hán hiển thị trên viên đan
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Độ hiếm</span>
            <select
              className="admin-input"
              value={draft.rarity}
              onChange={(e) =>
                set("rarity", Number(e.target.value) as PillRarity)
              }
              disabled={saving}
              aria-label="Độ hiếm"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {getRarityMeta(r).name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Hiệu ứng</h4>
          <span className="admin-form-section-hint">
            {EFFECT_HINTS[draft.effectKind]}
          </span>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Loại hiệu ứng</span>
            <select
              className="admin-input"
              value={draft.effectKind}
              onChange={(e) => setKind(e.target.value as PillEffectKind)}
              disabled={saving}
              aria-label="Loại hiệu ứng"
            >
              {EFFECT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {statFields.map((key) => {
            const err = findPillError(errors, key);
            return (
              <label className="admin-field" key={key}>
                <span className="admin-field-label">{STAT_LABELS[key]}</span>
                <input
                  type="number"
                  className={`admin-input admin-num${err ? " invalid" : ""}`}
                  value={numericValue(draft[key])}
                  onChange={(e) =>
                    set(
                      key,
                      e.target.value === ""
                        ? Number.NaN
                        : Number(e.target.value),
                    )
                  }
                  disabled={saving}
                  aria-label={STAT_LABELS[key]}
                />
                {err && (
                  <span className="admin-field-error">{err.message}</span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Phát hành</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Phát tân thủ</span>
            <input
              type="number"
              className={`admin-input${findPillError(errors, "starterQuantity") ? " invalid" : ""}`}
              value={numericValue(draft.starterQuantity)}
              onChange={(e) =>
                set(
                  "starterQuantity",
                  e.target.value === "" ? Number.NaN : Number(e.target.value),
                )
              }
              disabled={saving}
              aria-label="Số lượng phát cho người chơi mới"
            />
            <span className="admin-field-hint">
              0 = không phát cho người chơi mới
            </span>
            {findPillError(errors, "starterQuantity") && (
              <span className="admin-field-error">
                {findPillError(errors, "starterQuantity")?.message}
              </span>
            )}
          </label>
          <label className="admin-field admin-field--wide">
            <span className="admin-field-label">Mô tả</span>
            <textarea
              className={`admin-input${findPillError(errors, "desc") ? " invalid" : ""}`}
              value={draft.desc}
              onChange={(e) => set("desc", e.target.value)}
              rows={2}
              disabled={saving}
              aria-label="Mô tả đan dược"
            />
          </label>
        </div>
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
              Tắt để ẩn khỏi người chơi — túi đồ được giữ nguyên
            </span>
          </span>
        </label>
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

export default function AdminPillsPage() {
  const [pills, setPills] = useState<AdminPillDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "new" = the create form; a pill id = that pill's edit form; null = closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { pills: list } = await fetchAdminPills();
      setPills(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được danh sách");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Warn on tab close/refresh while an open form has unsaved edits. In-app
  // navigation is not intercepted (App Router has no route-guard API) —
  // consistent with the realms editor.
  useEffect(() => {
    if (!dirtyOpen) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyOpen]);

  // Changing which form is open unmounts the current one, discarding its
  // draft — confirm first when that draft has unsaved edits.
  const requestOpen = (next: string | null) => {
    if (
      dirtyOpen &&
      !window.confirm("Biểu mẫu đang mở có thay đổi chưa lưu. Bỏ thay đổi?")
    ) {
      return;
    }
    setOpenId(next);
  };

  const onSaved = (saved: AdminPillDTO) => {
    setPills((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      return prev.map((p) => (p.id === saved.id ? saved : p));
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
  if (pills === null) {
    return <p>Đang tải…</p>;
  }

  const editingPill =
    openId && openId !== "new" ? pills.find((p) => p.id === openId) : null;
  const isEditing = openId !== null;
  // Header context for the detail pane (glyph/name/rarity/effect chips).
  const headerPill = openId === "new" ? emptyPill() : editingPill;
  const headerMeta = headerPill ? getRarityMeta(headerPill.rarity) : null;

  return (
    <section>
      <div className="admin-topbar">
        <h2>Đan dược ({pills.length})</h2>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => requestOpen("new")}
          disabled={openId === "new"}
        >
          + Thêm đan dược
        </button>
      </div>

      <div className="admin-master-detail">
        <div className="admin-master-list">
          {pills.length === 0 && (
            <p className="admin-master-empty">
              Chưa có đan dược nào. Thêm viên đầu tiên để người chơi có thứ mà
              dùng.
            </p>
          )}
          {pills.map((pill) => {
            const meta = getRarityMeta(pill.rarity);
            return (
              <button
                key={pill.id}
                type="button"
                className={`admin-master-item${pill.active ? "" : " inactive"}`}
                aria-current={openId === pill.id}
                onClick={() => requestOpen(openId === pill.id ? null : pill.id)}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span
                      className="admin-row-glyph"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    >
                      {pill.glyph}
                    </span>
                    {pill.name}
                  </span>
                  <span
                    className={`admin-status admin-status--${pill.active ? "ok" : "off"}`}
                  >
                    {pill.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={pill.rarity} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span className="admin-num">{headlineStat(pill)}</span>
                  <span>
                    {pill.starterQuantity > 0
                      ? `Tân thủ ×${pill.starterQuantity}`
                      : meta.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="admin-detail"
          style={
            headerMeta
              ? ({ "--detail-tone": headerMeta.color } as CSSProperties)
              : undefined
          }
        >
          {isEditing && headerPill ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: headerMeta?.color }}
                  aria-hidden="true"
                >
                  {headerPill.glyph || "丹"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {openId === "new"
                      ? "Thêm đan dược mới"
                      : headerPill.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-chips">
                    <span
                      className="admin-chip admin-chip--tint"
                      style={{ color: headerMeta?.color }}
                    >
                      {headerMeta?.name}
                    </span>
                    <span className="admin-chip">
                      {effectLabel(headerPill.effectKind)}
                    </span>
                    {headerPill.starterQuantity > 0 && (
                      <span className="admin-chip admin-chip--ok">
                        Tân thủ ×{headerPill.starterQuantity}
                      </span>
                    )}
                    {!headerPill.active && (
                      <span className="admin-chip admin-chip--danger">
                        Đang tắt
                      </span>
                    )}
                  </div>
                  <div className="admin-detail-gauge">
                    <RarityPips
                      rarity={headerPill.rarity}
                      color={headerMeta?.color ?? "var(--muted)"}
                      size="lg"
                    />
                    <span className="admin-detail-gauge-label">
                      <span className="admin-num">
                        {headlineStat(headerPill)}
                      </span>{" "}
                      · {headerMeta?.name}
                    </span>
                  </div>
                </div>
              </div>
              <PillForm
                key={openId}
                initial={
                  openId === "new" ? emptyPill() : (editingPill as AdminPillDTO)
                }
                isNew={openId === "new"}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Chọn một đan dược để chỉnh sửa, hoặc thêm đan dược mới.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
