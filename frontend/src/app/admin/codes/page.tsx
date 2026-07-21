"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminCode,
  fetchAdminCodes,
  fetchAdminPills,
  updateAdminCode,
} from "@/lib/api";
import { findRedeemError, validateRedeemDraft } from "@/lib/redeem-validation";
import type { AdminPillDTO, AdminRedeemCodeDTO } from "@/lib/types";

type CodeDraft = Omit<AdminRedeemCodeDTO, "redeemedCount">;

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

  return (
    <div className="admin-pill-form">
      <div className="admin-pill-form-grid">
        {isNew && (
          <label>
            ID
            <input
              className={`admin-input${findRedeemError(errors, "id") ? " invalid" : ""}`}
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              aria-label="ID mã"
              placeholder="tan-thu-2026"
            />
            {findRedeemError(errors, "id") && (
              <span className="admin-field-error">
                {findRedeemError(errors, "id")?.message}
              </span>
            )}
          </label>
        )}
        {isNew && (
          <label>
            Mã code
            <input
              className={`admin-input${findRedeemError(errors, "code") ? " invalid" : ""}`}
              value={draft.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              aria-label="Mã code"
              placeholder="TANTHU2026"
            />
            {findRedeemError(errors, "code") && (
              <span className="admin-field-error">
                {findRedeemError(errors, "code")?.message}
              </span>
            )}
          </label>
        )}
        <label>
          Tổng lượt đổi tối đa
          <input
            type="number"
            className={`admin-input${findRedeemError(errors, "maxRedemptions") ? " invalid" : ""}`}
            value={numericValue(draft.maxRedemptions)}
            onChange={(e) =>
              set(
                "maxRedemptions",
                e.target.value === "" ? Number.NaN : Number(e.target.value),
              )
            }
            aria-label="Tổng lượt đổi tối đa"
          />
          {findRedeemError(errors, "maxRedemptions") && (
            <span className="admin-field-error">
              {findRedeemError(errors, "maxRedemptions")?.message}
            </span>
          )}
        </label>
        <label>
          Hết hạn (trống = không hết hạn)
          <input
            type="datetime-local"
            className="admin-input"
            value={isoToLocalInput(draft.expiresAt)}
            onChange={(e) =>
              set(
                "expiresAt",
                e.target.value ? new Date(e.target.value).toISOString() : null,
              )
            }
            aria-label="Thời điểm hết hạn"
          />
        </label>
        <label className="admin-pill-active">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          Kích hoạt (tắt để chặn đổi mã)
        </label>
      </div>

      <div className="admin-code-rewards">
        <h4>Phần thưởng (đan dược)</h4>
        {rewardsError && (
          <p className="admin-field-error">{rewardsError.message}</p>
        )}
        {draft.rewards.map((r, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, no stable id
            key={i}
            className="admin-code-reward-row"
          >
            <select
              className="admin-input"
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
            <input
              type="number"
              className="admin-input"
              style={{ width: 90 }}
              min={1}
              aria-label={`Số lượng hàng ${i + 1}`}
              value={numericValue(r.quantity)}
              onChange={(e) =>
                setReward(i, {
                  quantity:
                    e.target.value === "" ? Number.NaN : Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              className="admin-btn"
              aria-label={`Xóa hàng ${i + 1}`}
              onClick={() => removeReward(i)}
            >
              Xóa
            </button>
          </div>
        ))}
        <button type="button" className="admin-btn" onClick={addReward}>
          + Thêm đan dược
        </button>
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

      <div className="admin-pill-layout">
        {/* Master: one row per code. */}
        <div className="admin-pill-list">
          {codes.map((code) => {
            const exhausted = code.redeemedCount >= code.maxRedemptions;
            return (
              <button
                key={code.id}
                type="button"
                className={`admin-pill-list-item${code.active ? "" : " inactive"}`}
                aria-current={openId === code.id}
                style={{ "--rarity": "var(--gold)" } as CSSProperties}
                onClick={() => requestOpen(openId === code.id ? null : code.id)}
              >
                <span
                  className="admin-pill-list-name"
                  style={{ fontFamily: "var(--font-mono, monospace)" }}
                >
                  {code.code}
                </span>
                <span className="admin-pill-list-meta">
                  <span className="admin-pill-list-effect">
                    {code.redeemedCount}/{code.maxRedemptions} lượt
                    {code.expiresAt
                      ? ` · HSD ${new Date(code.expiresAt).toLocaleDateString("vi-VN")}`
                      : ""}
                  </span>
                </span>
                {exhausted && code.active && (
                  <span className="admin-pill-list-dot off" title="Hết lượt" />
                )}
                {!code.active && (
                  <span className="admin-pill-list-dot off" title="Đang tắt" />
                )}
              </button>
            );
          })}
        </div>

        {/* Detail: editor for the selected code, or an empty prompt. */}
        <div className="admin-pill-detail">
          {isEditing ? (
            <>
              <div className="admin-pill-detail-head">
                <div className="admin-pill-detail-title">
                  <h3>
                    {openId === "new"
                      ? "Tạo mã mới"
                      : (editingCode?.code ?? "(không rõ)")}
                  </h3>
                  {editingCode && (
                    <div className="admin-pill-chips">
                      <span className="admin-pill-effect-chip">
                        {editingCode.redeemedCount}/{editingCode.maxRedemptions}{" "}
                        lượt đã đổi
                      </span>
                      {!editingCode.active && (
                        <span className="admin-pill-off">Đang tắt</span>
                      )}
                    </div>
                  )}
                </div>
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
            <div className="admin-pill-detail-empty">
              <p>Chọn một mã để chỉnh sửa, hoặc tạo mã mới.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
