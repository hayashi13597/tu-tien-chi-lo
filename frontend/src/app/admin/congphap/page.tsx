"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { RarityPips } from "@/components/rarity-pips";
import {
  createAdminCongPhap,
  fetchAdminCongPhap,
  fetchAdminMaterials,
  grantToUser,
  searchAdminUsers,
  updateAdminCongPhap,
} from "@/lib/api";
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, effectAttributeLabel } from "@/lib/attribute-constants";
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
  MaterialDTO,
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
    upgradeMaterialId: null,
    baseMaterialCost: 0,
    materialCostGrowth: 1,
    dupRefundLinhThach: null,
    tier: 1,
    branch: "chienDao" as const,
    minRealmMajor: 0,
    biTichMaterialId: null,
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
      return `${effectAttributeLabel(e.attribute)} ${parts.join(" ")}`;
    })
    .join(", ");
}

interface CongPhapFormProps {
  initial: CongPhapDTO;
  isNew: boolean;
  materials: MaterialDTO[];
  onSaved: (saved: CongPhapDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CongPhapForm({
  initial,
  isNew,
  materials,
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
    <div className="admin-form">
      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Nhận dạng</h4>
        </div>
        <div className="admin-form-grid">
          <label>
            <span className="admin-field-label">ID</span>
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
          <label className="admin-field">
            <span className="admin-field-label">Tên</span>
            <input
              className={`admin-input${err("name") ? " invalid" : ""}`}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={saving}
              aria-label="Tên công pháp"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Glyph</span>
            <input
              className={`admin-input${err("glyph") ? " invalid" : ""}`}
              value={draft.glyph}
              onChange={(e) => set("glyph", e.target.value)}
              disabled={saving}
              aria-label="Glyph công pháp"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Độ hiếm</span>
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
          <label className="admin-field">
            <span className="admin-field-label">Loại</span>
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
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Thăng cấp</h4>
          {costPreview && (
            <span className="admin-form-section-hint admin-num">
              {costPreview}
            </span>
          )}
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Cấp tối đa</span>
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
          <label className="admin-field">
            <span className="admin-field-label">Chi phí gốc (Linh Thạch)</span>
            <input
              type="number"
              className={`admin-input admin-num${err("baseCost") ? " invalid" : ""}`}
              value={numericValue(draft.baseCost)}
              onChange={(e) => set("baseCost", numeric(e.target.value))}
              disabled={saving}
              aria-label="Chi phí gốc"
            />
            <span className="admin-field-hint">Chi phí lên cấp 1 → 2</span>
            {err("baseCost") && (
              <span className="admin-field-error">
                {err("baseCost")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Hệ số tăng chi phí</span>
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
          <label className="admin-field">
            <span className="admin-field-label">Quy đổi khi trùng</span>
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
            <span className="admin-field-hint">
              (tùy chọn) bỏ trống thì lấy chi phí gốc
            </span>
            {err("dupRefundLinhThach") && (
              <span className="admin-field-error">
                {err("dupRefundLinhThach")?.message}
              </span>
            )}
          </label>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span className="admin-field-label">Nguyên liệu nâng cấp</span>
            <select
              className={`admin-input${err("upgradeMaterialId") ? " invalid" : ""}`}
              value={draft.upgradeMaterialId ?? ""}
              onChange={(e) =>
                set(
                  "upgradeMaterialId",
                  e.target.value === "" ? null : e.target.value,
                )
              }
              disabled={saving || materials.length === 0}
              aria-label="Nguyên liệu nâng cấp công pháp"
            >
              <option value="">Không dùng nguyên liệu</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.glyph} {material.name}
                  {material.active ? "" : " (đã tắt)"}
                </option>
              ))}
            </select>
            <span className="admin-field-hint">
              {materials.length === 0
                ? "Chưa có catalog nguyên liệu"
                : "Chi phí này cộng với Linh Thạch khi nâng cấp"}
            </span>
            {err("upgradeMaterialId") && (
              <span className="admin-field-error">
                {err("upgradeMaterialId")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Nguyên liệu/cấp đầu</span>
            <input
              type="number"
              min={0}
              className={`admin-input admin-num${err("baseMaterialCost") ? " invalid" : ""}`}
              value={numericValue(draft.baseMaterialCost)}
              onChange={(e) => set("baseMaterialCost", numeric(e.target.value))}
              disabled={saving}
              aria-label="Chi phí nguyên liệu cấp đầu"
            />
            <span className="admin-field-hint">Chi phí cho cấp 1 → 2</span>
            {err("baseMaterialCost") && (
              <span className="admin-field-error">
                {err("baseMaterialCost")?.message}
              </span>
            )}
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Hệ số tăng nguyên liệu</span>
            <input
              type="number"
              min={1}
              step="0.1"
              className={`admin-input admin-num${err("materialCostGrowth") ? " invalid" : ""}`}
              value={numericValue(draft.materialCostGrowth)}
              onChange={(e) =>
                set("materialCostGrowth", numeric(e.target.value))
              }
              disabled={saving}
              aria-label="Hệ số tăng chi phí nguyên liệu"
            />
            {err("materialCostGrowth") && (
              <span className="admin-field-error">
                {err("materialCostGrowth")?.message}
              </span>
            )}
          </label>
        </div>
      </section>

      {draft.category === "active" && (
        <section className="admin-form-section">
          <div className="admin-form-section-head">
            <h4 className="admin-form-section-title">Kỹ năng chủ động</h4>
            <span className="admin-form-section-hint">
              lưu sẵn cho phase combat — chưa áp dụng vào chiến lực
            </span>
          </div>
          <div className="admin-form-grid">
            <label className="admin-field">
              <span className="admin-field-label">Sức mạnh mỗi cấp</span>
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
            <label className="admin-field">
              <span className="admin-field-label">Chân nguyên tiêu hao</span>
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
          </div>
        </section>
      )}

      <section className="admin-form-section">
        <div className="admin-form-section-head">
          <h4 className="admin-form-section-title">Phát hành</h4>
        </div>
        <div className="admin-form-grid">
          <label className="admin-field admin-field--wide">
            <span className="admin-field-label">Mô tả</span>
            <textarea
              className={`admin-input${err("desc") ? " invalid" : ""}`}
              value={draft.desc}
              onChange={(e) => set("desc", e.target.value)}
              rows={2}
              disabled={saving}
              aria-label="Mô tả công pháp"
            />
          </label>
        </div>
        <label className="admin-switch">
          <input
            type="checkbox"
            className="admin-switch-input"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            disabled={saving}
            aria-label="Đang kích hoạt"
          />
          <span className="admin-switch-track" aria-hidden="true" />
          <span className="admin-switch-text">
            <span className="admin-switch-title">Kích hoạt</span>
            <span className="admin-field-hint">
              Tắt để ẩn khỏi người chơi — công pháp đã sở hữu vẫn còn nhưng
              ngừng có tác dụng
            </span>
          </span>
        </label>
      </section>

      {/* Passive effects editor — the list the domain requires to be non-empty. */}
      {draft.category === "passive" && (
        <section className="admin-form-section">
          <div className="admin-form-section-head">
            <h4 className="admin-form-section-title">Hiệu ứng bị động</h4>
            <span className="admin-form-section-hint">
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
              className="admin-row"
            >
              <select
                className="admin-input admin-row-grow"
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
              <label className="admin-row-field">
                <span>Cộng phẳng/cấp</span>
                <input
                  type="number"
                  className="admin-input admin-num admin-row-num"
                  value={numericValue(effect.flatPerLevel)}
                  aria-label={`Cộng phẳng hàng ${i + 1}`}
                  disabled={saving}
                  onChange={(e) =>
                    setEffect(i, { flatPerLevel: numeric(e.target.value) })
                  }
                />
              </label>
              <label className="admin-row-field">
                <span>Cộng %/cấp</span>
                <input
                  type="number"
                  className="admin-input admin-num admin-row-num"
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
                className="admin-btn admin-row-remove"
                aria-label={`Xóa hiệu ứng hàng ${i + 1}`}
                disabled={saving}
                onClick={() => removeEffect(i)}
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="admin-btn admin-row-add"
            onClick={addEffect}
            disabled={saving}
          >
            + Thêm hiệu ứng
          </button>
        </section>
      )}

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
      <div className="admin-form-section-head">
        <h3 className="admin-form-section-title">Cấp thưởng</h3>
        <span className="admin-form-section-hint">
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
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [{ congphap }, { materials: loadedMaterials }] = await Promise.all([
        fetchAdminCongPhap(),
        fetchAdminMaterials(),
      ]);
      setList(congphap);
      setMaterials(loadedMaterials);
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

      <div className="admin-master-detail">
        <div className="admin-master-list">
          {list.length === 0 && (
            <p className="admin-master-empty">
              Chưa có công pháp nào. Thêm công pháp đầu tiên.
            </p>
          )}
          {list.map((def) => {
            const meta = getCongPhapRarityMeta(def.rarity);
            return (
              <button
                key={def.id}
                type="button"
                className={`admin-master-item${def.active ? "" : " inactive"}`}
                aria-current={openId === def.id}
                onClick={() => requestOpen(openId === def.id ? null : def.id)}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span
                      className="admin-row-glyph"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    >
                      {def.glyph}
                    </span>
                    {def.name}
                  </span>
                  <span
                    className={`admin-status admin-status--${def.active ? "ok" : "off"}`}
                  >
                    {def.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={def.rarity} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span className="admin-num">{headline(def)}</span>
                  <span>
                    {def.category === "passive" ? "Bị động" : "Chủ động"}
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
          {openId !== null && headerDef ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: headerMeta?.color }}
                  aria-hidden="true"
                >
                  {headerDef.glyph || "功"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {openId === "new"
                      ? "Thêm công pháp mới"
                      : headerDef.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-chips">
                    <span
                      className="admin-chip admin-chip--tint"
                      style={{ color: headerMeta?.color }}
                    >
                      {headerMeta?.name}
                    </span>
                    <span className="admin-chip">
                      {headerDef.category === "passive"
                        ? "Bị động"
                        : "Chủ động"}
                    </span>
                    <span className="admin-chip">
                      Tối đa cấp {headerDef.maxLevel}
                    </span>
                    {!headerDef.active && (
                      <span className="admin-chip admin-chip--danger">
                        Đang tắt
                      </span>
                    )}
                  </div>
                  <div className="admin-detail-gauge">
                    <RarityPips
                      rarity={headerDef.rarity}
                      color={headerMeta?.color ?? "var(--muted)"}
                      size="lg"
                    />
                    <span className="admin-detail-gauge-label">
                      <span className="admin-num">{headline(headerDef)}</span> ·{" "}
                      {headerMeta?.name}
                    </span>
                  </div>
                </div>
              </div>
              <CongPhapForm
                key={openId}
                initial={
                  openId === "new" ? emptyCongPhap() : (editing as CongPhapDTO)
                }
                isNew={openId === "new"}
                materials={materials}
                onSaved={onSaved}
                onCancel={() => setOpenId(null)}
                onDirtyChange={setDirtyOpen}
              />
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Chọn một công pháp để chỉnh sửa, hoặc thêm công pháp mới.</p>
            </div>
          )}
        </div>
      </div>

      <GrantPanel catalog={list} />
    </section>
  );
}
