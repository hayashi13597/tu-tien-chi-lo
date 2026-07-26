"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminCongPhap,
  fetchAdminCongPhap,
  grantToUser,
  searchAdminUsers,
  updateAdminCongPhap,
} from "@/lib/api";
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from "@/lib/attribute-constants";
import { getCongPhapRarityMeta, levelUpCost } from "@/lib/congphap-display";
import {
  findCongPhapError,
  validateCongPhapDraft,
} from "@/lib/congphap-validation";
import { formatNum } from "@/lib/format";
import type {
  AdminUserDTO,
  AttributeKey,
  CongPhapCategory,
  CongPhapDTO,
  PassiveEffectDTO,
} from "@/lib/types";

const CATEGORIES: { value: CongPhapCategory; label: string }[] = [
  { value: "passive", label: "Bị động (cộng thuộc tính)" },
  { value: "active", label: "Chủ động (kỹ năng combat)" },
];

const RARITIES = [0, 1, 2, 3, 4];

// Switching category resets the other category's fields: the backend rejects
// a passive that carries powerPerLevel, or an active that carries effects.
function fieldsForCategory(
  category: CongPhapCategory,
): Pick<CongPhapDTO, "effects" | "powerPerLevel" | "chanNguyenCost"> {
  return category === "passive"
    ? {
        effects: [{ attribute: "khiHuyet", flatPerLevel: 10, pctPerLevel: 0 }],
        powerPerLevel: null,
        chanNguyenCost: null,
      }
    : { effects: null, powerPerLevel: 100, chanNguyenCost: 20 };
}

function emptyCongPhap(): CongPhapDTO {
  return {
    id: "",
    name: "",
    glyph: "",
    rarity: 1,
    category: "passive",
    desc: "",
    active: true,
    maxLevel: 10,
    baseCost: 100,
    costGrowth: 1.5,
    dupRefundLinhThach: null,
    ...fieldsForCategory("passive"),
  };
}

// One-line effect summary for the collapsed list row.
function headline(def: CongPhapDTO): string {
  if (def.category === "active") {
    return `Sức mạnh ${def.powerPerLevel ?? "?"}/cấp`;
  }
  if (!def.effects || def.effects.length === 0) return "Chưa có hiệu ứng";
  return def.effects
    .map((e) => {
      const parts: string[] = [];
      if (e.flatPerLevel !== 0) parts.push(`+${e.flatPerLevel}`);
      if (e.pctPerLevel !== 0) parts.push(`+${e.pctPerLevel}%`);
      return `${ATTRIBUTE_LABELS[e.attribute]} ${parts.join(" ")}`;
    })
    .join(", ");
}

interface CongPhapFormProps {
  initial: CongPhapDTO;
  isNew: boolean;
  onSaved: (saved: CongPhapDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CongPhapForm({
  initial,
  isNew,
  onSaved,
  onCancel,
  onDirtyChange,
}: CongPhapFormProps) {
  const [draft, setDraft] = useState<CongPhapDTO>(() =>
    structuredClone(initial),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(
    () => validateCongPhapDraft(draft, { isNew }),
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

  const set = <K extends keyof CongPhapDTO>(key: K, value: CongPhapDTO[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setCategory = (category: CongPhapCategory) =>
    setDraft((d) => ({ ...d, category, ...fieldsForCategory(category) }));

  const setEffect = (idx: number, patch: Partial<PassiveEffectDTO>) =>
    setDraft((d) => ({
      ...d,
      effects: (d.effects ?? []).map((e, i) =>
        i === idx ? { ...e, ...patch } : e,
      ),
    }));

  const addEffect = () =>
    setDraft((d) => ({
      ...d,
      effects: [
        ...(d.effects ?? []),
        { attribute: "khiHuyet", flatPerLevel: 10, pctPerLevel: 0 },
      ],
    }));

  const removeEffect = (idx: number) =>
    setDraft((d) => ({
      ...d,
      effects: (d.effects ?? []).filter((_, i) => i !== idx),
    }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = isNew
        ? await createAdminCongPhap(draft)
        : await updateAdminCongPhap(
            draft.id,
            (({ id: _id, ...body }) => body)(draft),
          );
      onSaved(saved);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  // Empty numeric input becomes NaN, which validation flags — never silent 0.
  const numericValue = (v: number | null) =>
    v === null || Number.isNaN(v) ? "" : v;
  const numeric = (raw: string) => (raw === "" ? Number.NaN : Number(raw));

  const err = (field: string) => findCongPhapError(errors, field);
  // Cost preview so the balance of baseCost × costGrowth is legible at a glance.
  const costPreview =
    Number.isFinite(draft.baseCost) && Number.isFinite(draft.costGrowth)
      ? [1, 2, 3]
          .filter((lv) => lv < draft.maxLevel)
          .map((lv) => `${lv}→${lv + 1}: ${formatNum(levelUpCost(draft, lv))}`)
          .join(" · ")
      : "";

  return (
    <div className="admin-pill-form">
      <div className="admin-pill-form-grid">
        <label>
          ID
          <input
            className={`admin-input${err("id") ? " invalid" : ""}`}
            value={draft.id}
            onChange={(e) => set("id", e.target.value)}
            readOnly={!isNew}
            disabled={saving}
            aria-label="ID công pháp"
          />
          {err("id") && (
            <span className="admin-field-error">{err("id")?.message}</span>
          )}
        </label>
        <label>
          Tên
          <input
            className={`admin-input${err("name") ? " invalid" : ""}`}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={saving}
            aria-label="Tên công pháp"
          />
        </label>
        <label>
          Glyph
          <input
            className={`admin-input${err("glyph") ? " invalid" : ""}`}
            value={draft.glyph}
            onChange={(e) => set("glyph", e.target.value)}
            disabled={saving}
            aria-label="Glyph công pháp"
          />
        </label>
        <label>
          Độ hiếm
          <select
            className="admin-input"
            value={draft.rarity}
            onChange={(e) => set("rarity", Number(e.target.value))}
            disabled={saving}
            aria-label="Độ hiếm"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {getCongPhapRarityMeta(r).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Loại
          <select
            className="admin-input"
            value={draft.category}
            onChange={(e) => setCategory(e.target.value as CongPhapCategory)}
            disabled={saving}
            aria-label="Loại công pháp"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cấp tối đa
          <input
            type="number"
            className={`admin-input admin-num${err("maxLevel") ? " invalid" : ""}`}
            value={numericValue(draft.maxLevel)}
            onChange={(e) => set("maxLevel", numeric(e.target.value))}
            disabled={saving}
            aria-label="Cấp tối đa"
          />
          {err("maxLevel") && (
            <span className="admin-field-error">
              {err("maxLevel")?.message}
            </span>
          )}
        </label>
        <label>
          Chi phí gốc (Linh Thạch)
          <input
            type="number"
            className={`admin-input admin-num${err("baseCost") ? " invalid" : ""}`}
            value={numericValue(draft.baseCost)}
            onChange={(e) => set("baseCost", numeric(e.target.value))}
            disabled={saving}
            aria-label="Chi phí gốc"
          />
          {err("baseCost") && (
            <span className="admin-field-error">
              {err("baseCost")?.message}
            </span>
          )}
        </label>
        <label>
          Hệ số tăng chi phí
          <input
            type="number"
            step="0.1"
            className={`admin-input admin-num${err("costGrowth") ? " invalid" : ""}`}
            value={numericValue(draft.costGrowth)}
            onChange={(e) => set("costGrowth", numeric(e.target.value))}
            disabled={saving}
            aria-label="Hệ số tăng chi phí"
          />
          {err("costGrowth") && (
            <span className="admin-field-error">
              {err("costGrowth")?.message}
            </span>
          )}
        </label>
        <label>
          Quy đổi khi trùng (bỏ trống = chi phí gốc)
          <input
            type="number"
            className={`admin-input admin-num${err("dupRefundLinhThach") ? " invalid" : ""}`}
            value={numericValue(draft.dupRefundLinhThach)}
            onChange={(e) =>
              set(
                "dupRefundLinhThach",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            disabled={saving}
            aria-label="Linh Thạch quy đổi khi redeem trùng"
          />
          {err("dupRefundLinhThach") && (
            <span className="admin-field-error">
              {err("dupRefundLinhThach")?.message}
            </span>
          )}
        </label>

        {draft.category === "active" && (
          <>
            <label>
              Sức mạnh mỗi cấp
              <input
                type="number"
                className={`admin-input admin-num${err("powerPerLevel") ? " invalid" : ""}`}
                value={numericValue(draft.powerPerLevel)}
                onChange={(e) => set("powerPerLevel", numeric(e.target.value))}
                disabled={saving}
                aria-label="Sức mạnh mỗi cấp"
              />
              {err("powerPerLevel") && (
                <span className="admin-field-error">
                  {err("powerPerLevel")?.message}
                </span>
              )}
            </label>
            <label>
              Chân nguyên tiêu hao (bỏ trống nếu không dùng)
              <input
                type="number"
                className={`admin-input admin-num${err("chanNguyenCost") ? " invalid" : ""}`}
                value={numericValue(draft.chanNguyenCost)}
                onChange={(e) =>
                  set(
                    "chanNguyenCost",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                disabled={saving}
                aria-label="Chân nguyên tiêu hao"
              />
              {err("chanNguyenCost") && (
                <span className="admin-field-error">
                  {err("chanNguyenCost")?.message}
                </span>
              )}
            </label>
          </>
        )}

        <label className="admin-pill-desc">
          Mô tả
          <textarea
            className={`admin-input${err("desc") ? " invalid" : ""}`}
            value={draft.desc}
            onChange={(e) => set("desc", e.target.value)}
            rows={2}
            disabled={saving}
            aria-label="Mô tả công pháp"
          />
        </label>
        <label className="admin-pill-active">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            disabled={saving}
            aria-label="Đang kích hoạt"
          />
          Kích hoạt (tắt để ẩn khỏi người chơi — công pháp đã sở hữu được giữ
          nguyên nhưng ngừng có tác dụng)
        </label>
      </div>

      {costPreview && (
        <p className="admin-congphap-cost-preview">Chi phí: {costPreview}</p>
      )}

      {/* Passive effects editor — the list the domain requires to be non-empty. */}
      {draft.category === "passive" && (
        <div className="admin-congphap-effects">
          <div className="admin-code-section-head">
            <h4 className="admin-code-section-title">Hiệu ứng bị động</h4>
            <span className="admin-code-section-hint">
              cộng phẳng trước, phần trăm sau — nhân với cấp
            </span>
          </div>
          {err("effects") && (
            <p className="admin-field-error">{err("effects")?.message}</p>
          )}
          {(draft.effects ?? []).map((effect, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: effect rows are positional, no stable id
              key={i}
              className="admin-congphap-effect-row"
            >
              <select
                className="admin-input"
                value={effect.attribute}
                aria-label={`Thuộc tính hàng ${i + 1}`}
                disabled={saving}
                onChange={(e) =>
                  setEffect(i, { attribute: e.target.value as AttributeKey })
                }
              >
                {ATTRIBUTE_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {ATTRIBUTE_LABELS[key]}
                  </option>
                ))}
              </select>
              <label>
                Cộng phẳng/cấp
                <input
                  type="number"
                  className="admin-input admin-num"
                  value={numericValue(effect.flatPerLevel)}
                  aria-label={`Cộng phẳng hàng ${i + 1}`}
                  disabled={saving}
                  onChange={(e) =>
                    setEffect(i, { flatPerLevel: numeric(e.target.value) })
                  }
                />
              </label>
              <label>
                Cộng %/cấp
                <input
                  type="number"
                  className="admin-input admin-num"
                  value={numericValue(effect.pctPerLevel)}
                  aria-label={`Cộng phần trăm hàng ${i + 1}`}
                  disabled={saving}
                  onChange={(e) =>
                    setEffect(i, { pctPerLevel: numeric(e.target.value) })
                  }
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                aria-label={`Xóa hiệu ứng hàng ${i + 1}`}
                disabled={saving}
                onClick={() => removeEffect(i)}
              >
                Xóa
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={addEffect}
            disabled={saving}
          >
            + Thêm hiệu ứng
          </button>
        </div>
      )}

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

// --- Grant block ------------------------------------------------------------

function GrantPanel({ catalog }: { catalog: CongPhapDTO[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserDTO[]>([]);
  const [selected, setSelected] = useState<AdminUserDTO | null>(null);
  const [congPhapId, setCongPhapId] = useState("");
  const [linhThach, setLinhThach] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced search: typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { users } = await searchAdminUsers(query);
        setResults(users);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tìm được người chơi");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const amount = linhThach === "" ? 0 : Number(linhThach);
  const canSubmit =
    selected !== null &&
    !busy &&
    (congPhapId !== "" || (Number.isInteger(amount) && amount > 0));

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await grantToUser({
        userId: selected.id,
        ...(congPhapId ? { congPhapId } : {}),
        ...(amount > 0 ? { linhThach: amount } : {}),
      });
      setMessage(`Đã cấp cho ${selected.username}.`);
      setCongPhapId("");
      setLinhThach("");
      // Re-read so the row shows the new Linh Thạch balance.
      const { users } = await searchAdminUsers(query);
      setResults(users);
      setSelected(users.find((u) => u.id === selected.id) ?? selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cấp thưởng thất bại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-panel admin-grant">
      <div className="admin-code-section-head">
        <h3 className="admin-code-section-title">Cấp thưởng</h3>
        <span className="admin-code-section-hint">
          cấp trực tiếp công pháp và/hoặc Linh Thạch cho một người chơi
        </span>
      </div>

      <label className="admin-grant-search">
        Tìm người chơi
        <input
          className="admin-input"
          value={query}
          placeholder="Nhập tên đăng nhập…"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm người chơi theo tên đăng nhập"
        />
      </label>

      <div className="admin-grant-results">
        {results.length === 0 ? (
          <p className="admin-grant-empty">Không có người chơi phù hợp.</p>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              className="admin-grant-user"
              aria-current={selected?.id === u.id}
              onClick={() => setSelected(u)}
            >
              <span className="admin-grant-user-name">{u.username}</span>
              <span className="admin-grant-user-meta admin-num">
                Cảnh giới {u.realmMajor}-{u.realmSub} · {formatNum(u.linhThach)}{" "}
                Linh Thạch
              </span>
            </button>
          ))
        )}
      </div>

      <div className="admin-grant-form">
        <label>
          Công pháp
          <select
            className="admin-input"
            value={congPhapId}
            disabled={busy}
            aria-label="Công pháp cần cấp"
            onChange={(e) => setCongPhapId(e.target.value)}
          >
            <option value="">-- Không cấp --</option>
            {catalog.map((cp) => (
              <option key={cp.id} value={cp.id}>
                {cp.name}
                {cp.active ? "" : " (đã tắt)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Linh Thạch
          <input
            type="number"
            className="admin-input admin-num"
            value={linhThach}
            min={0}
            disabled={busy}
            aria-label="Số Linh Thạch cần cấp"
            onChange={(e) => setLinhThach(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={!canSubmit}
          onClick={submit}
        >
          {busy
            ? "Đang cấp…"
            : selected
              ? `Cấp cho ${selected.username}`
              : "Chọn người chơi"}
        </button>
      </div>

      {message && <p className="admin-grant-ok">{message}</p>}
      {error && <p className="admin-error">{error}</p>}
    </section>
  );
}

// --- Page -------------------------------------------------------------------

export default function AdminCongPhapPage() {
  const [list, setList] = useState<CongPhapDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { congphap } = await fetchAdminCongPhap();
      setList(congphap);
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

  const onSaved = (saved: CongPhapDTO) => {
    setList((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx === -1) return [...prev, saved];
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
  if (list === null) {
    return <p>Đang tải…</p>;
  }

  const editing =
    openId && openId !== "new" ? list.find((c) => c.id === openId) : null;
  const headerDef = openId === "new" ? emptyCongPhap() : editing;
  const headerMeta = headerDef ? getCongPhapRarityMeta(headerDef.rarity) : null;

  return (
    <section>
      <div className="admin-topbar">
        <h2>Công pháp ({list.length})</h2>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => requestOpen("new")}
          disabled={openId === "new"}
        >
          + Thêm công pháp
        </button>
      </div>

      <div className="admin-pill-layout">
        <div className="admin-pill-list">
          {list.map((def) => {
            const meta = getCongPhapRarityMeta(def.rarity);
            return (
              <button
                key={def.id}
                type="button"
                className={`admin-pill-list-item${def.active ? "" : " inactive"}`}
                aria-current={openId === def.id}
                style={{ "--rarity": meta.color } as CSSProperties}
                onClick={() => requestOpen(openId === def.id ? null : def.id)}
              >
                <span
                  className="admin-pill-list-glyph"
                  style={{ color: meta.color }}
                >
                  {def.glyph}
                </span>
                <span className="admin-pill-list-meta">
                  <span className="admin-pill-list-name">{def.name}</span>
                  <span className="admin-pill-list-effect">
                    {headline(def)}
                  </span>
                </span>
                {!def.active && (
                  <span className="admin-pill-list-dot off" title="Đang tắt" />
                )}
              </button>
            );
          })}
        </div>

        <div className="admin-pill-detail">
          {openId !== null && headerDef ? (
            <>
              <div className="admin-pill-detail-head">
                <span
                  className="admin-pill-glyph"
                  style={{ color: headerMeta?.color }}
                >
                  {headerDef.glyph || "功"}
                </span>
                <div className="admin-pill-detail-title">
                  <h3>
                    {openId === "new"
                      ? "Thêm công pháp mới"
                      : headerDef.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-pill-chips">
                    <span
                      className="admin-pill-rarity"
                      style={{ color: headerMeta?.color }}
                    >
                      {headerMeta?.name}
                    </span>
                    <span className="admin-pill-effect-chip">
                      {headerDef.category === "passive"
                        ? "Bị động"
                        : "Chủ động"}
                    </span>
                    {!headerDef.active && (
                      <span className="admin-pill-off">Đang tắt</span>
                    )}
                  </div>
                </div>
              </div>
              <CongPhapForm
                key={openId}
                initial={
                  openId === "new" ? emptyCongPhap() : (editing as CongPhapDTO)
                }
                isNew={openId === "new"}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-pill-detail-empty">
              <p>Chọn một công pháp để chỉnh sửa, hoặc thêm công pháp mới.</p>
            </div>
          )}
        </div>
      </div>

      <GrantPanel catalog={list} />
    </section>
  );
}
