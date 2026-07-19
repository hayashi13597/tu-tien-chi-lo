"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="admin-pill-form">
      <div className="admin-pill-form-grid">
        <label>
          ID
          <input
            className={`admin-input${idError ? " invalid" : ""}`}
            value={draft.id}
            onChange={(e) => set("id", e.target.value)}
            readOnly={!isNew}
            aria-label="ID đan dược"
          />
          {idError && (
            <span className="admin-field-error">{idError.message}</span>
          )}
        </label>
        <label>
          Tên
          <input
            className={`admin-input${findPillError(errors, "name") ? " invalid" : ""}`}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            aria-label="Tên đan dược"
          />
        </label>
        <label>
          Glyph
          <input
            className={`admin-input${findPillError(errors, "glyph") ? " invalid" : ""}`}
            value={draft.glyph}
            onChange={(e) => set("glyph", e.target.value)}
            aria-label="Glyph đan dược"
          />
        </label>
        <label>
          Độ hiếm
          <select
            className="admin-input"
            value={draft.rarity}
            onChange={(e) =>
              set("rarity", Number(e.target.value) as PillRarity)
            }
            aria-label="Độ hiếm"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {getRarityMeta(r).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hiệu ứng
          <select
            className="admin-input"
            value={draft.effectKind}
            onChange={(e) => setKind(e.target.value as PillEffectKind)}
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
            <label key={key}>
              {STAT_LABELS[key]}
              <input
                type="number"
                className={`admin-input${err ? " invalid" : ""}`}
                value={numericValue(draft[key])}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === "" ? Number.NaN : Number(e.target.value),
                  )
                }
                aria-label={STAT_LABELS[key]}
              />
              {err && <span className="admin-field-error">{err.message}</span>}
            </label>
          );
        })}
        <label>
          Phát tân thủ
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
            aria-label="Số lượng phát cho người chơi mới"
          />
          {findPillError(errors, "starterQuantity") && (
            <span className="admin-field-error">
              {findPillError(errors, "starterQuantity")?.message}
            </span>
          )}
        </label>
        <label className="admin-pill-desc">
          Mô tả
          <textarea
            className={`admin-input${findPillError(errors, "desc") ? " invalid" : ""}`}
            value={draft.desc}
            onChange={(e) => set("desc", e.target.value)}
            rows={2}
            aria-label="Mô tả đan dược"
          />
        </label>
        <label className="admin-pill-active">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          Kích hoạt (tắt để ẩn khỏi người chơi — túi đồ được giữ nguyên)
        </label>
      </div>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-toolbar">
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

  return (
    <div>
      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => setOpenId("new")}
          disabled={openId === "new"}
        >
          Thêm đan dược
        </button>
      </div>

      {openId === "new" && (
        <div className="admin-pill-card">
          <PillForm
            initial={emptyPill()}
            isNew
            onSaved={onSaved}
            onCancel={() => setOpenId(null)}
            onDirtyChange={setDirtyOpen}
          />
        </div>
      )}

      <div className="admin-pill-list">
        {pills.map((pill) => {
          const meta = getRarityMeta(pill.rarity);
          const open = openId === pill.id;
          return (
            <div
              key={pill.id}
              className={`admin-pill-card${pill.active ? "" : " inactive"}`}
            >
              <button
                type="button"
                className="admin-pill-head"
                onClick={() => setOpenId(open ? null : pill.id)}
                aria-expanded={open}
              >
                <span
                  className="admin-pill-glyph"
                  style={{ color: meta.color }}
                >
                  {pill.glyph}
                </span>
                <span className="admin-pill-name">{pill.name}</span>
                <span
                  className="admin-pill-rarity"
                  style={{ color: meta.color }}
                >
                  {meta.name}
                </span>
                <span className="admin-pill-stat">{headlineStat(pill)}</span>
                {pill.starterQuantity > 0 && (
                  <span className="admin-pill-starter">
                    Tân thủ ×{pill.starterQuantity}
                  </span>
                )}
                {!pill.active && (
                  <span className="admin-pill-off">Đang tắt</span>
                )}
              </button>
              {open && (
                <PillForm
                  initial={pill}
                  isNew={false}
                  onSaved={onSaved}
                  onCancel={() => setOpenId(null)}
                  onDirtyChange={setDirtyOpen}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
