"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminRealms, updateAdminRealms } from "@/lib/api";
import { findError, validateRealmDraft } from "@/lib/realm-validation";
import type { RealmConfigDTO, SubStageConfigDTO } from "@/lib/types";

// Numeric tunable columns, in display order. name is handled separately.
const NUMERIC_FIELDS: { key: keyof SubStageConfigDTO; label: string }[] = [
  { key: "linhKhiRequired", label: "Linh khí cần" },
  { key: "cultivationRate", label: "Tốc độ tu" },
  { key: "baseSuccessRate", label: "Tỉ lệ gốc (%)" },
  { key: "pityIncrement", label: "Cộng dồn (%)" },
  { key: "maxSuccessRate", label: "Tỉ lệ tối đa (%)" },
  { key: "punishmentSeconds", label: "Phạt (giây)" },
];

function emptyStage(): SubStageConfigDTO {
  return {
    name: "Tân Kỳ",
    linhKhiRequired: 1,
    cultivationRate: 1,
    baseSuccessRate: 90,
    pityIncrement: 10,
    maxSuccessRate: 95,
    punishmentSeconds: 300,
  };
}

export default function AdminRealmsPage() {
  const [server, setServer] = useState<RealmConfigDTO[] | null>(null);
  const [draft, setDraft] = useState<RealmConfigDTO[] | null>(null);
  const [selectedRealm, setSelectedRealm] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // While a save is in flight, every draft-mutating control is disabled —
  // an edit made mid-save would be silently clobbered when the response
  // re-syncs the draft from the server's accepted copy.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const router = useRouter();

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(server),
    [draft, server],
  );
  const errors = useMemo(
    () => (draft ? validateRealmDraft(draft) : []),
    [draft],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { realms } = await fetchAdminRealms();
      setServer(realms);
      setDraft(structuredClone(realms));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không tải được cấu hình";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setLoadError(message);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warn on tab close / reload while edits are unsaved. In-app nav via the
  // rail links is not intercepted (Next App Router has no route-guard API);
  // beforeunload covers the destructive cases.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // All draft edits go through one immutable updater so React re-renders and
  // the dirty/validation memos recompute.
  const updateDraft = useCallback(
    (fn: (draft: RealmConfigDTO[]) => RealmConfigDTO[]) => {
      setDraft((d) => (d ? fn(structuredClone(d)) : d));
    },
    [],
  );

  const setRealmName = (ri: number, name: string) =>
    updateDraft((d) => {
      d[ri].name = name;
      return d;
    });

  const setSubField = (
    ri: number,
    si: number,
    key: keyof SubStageConfigDTO,
    raw: string,
  ) =>
    updateDraft((d) => {
      const sub = d[ri].subStages[si];
      if (key === "name") {
        sub.name = raw;
      } else {
        // Empty input → NaN → caught by validation (Save disabled) instead of
        // silently coercing to 0.
        (sub[key] as number) = raw === "" ? Number.NaN : Number(raw);
      }
      return d;
    });

  const addRealm = () => {
    updateDraft((d) => {
      d.push({ name: "Cảnh giới mới", subStages: [emptyStage()] });
      return d;
    });
    // Focus the newly appended realm.
    setSelectedRealm(draft?.length ?? 0);
  };

  const removeRealm = (ri: number) => {
    updateDraft((d) => {
      d.splice(ri, 1);
      return d;
    });
    // Selection is a single index; realms after the removed one shift down by
    // one. Mirror the old open-set remap: drop if it was the removed realm,
    // decrement if it was above, clamp into range.
    setSelectedRealm((sel) => {
      const remaining = (draft?.length ?? 1) - 1;
      let next = sel;
      if (sel > ri) next = sel - 1;
      else if (sel === ri) next = Math.min(sel, remaining - 1);
      return Math.max(0, next);
    });
  };

  const addSubStage = (ri: number) =>
    updateDraft((d) => {
      const stages = d[ri].subStages;
      const last = stages[stages.length - 1];
      const next = emptyStage();
      if (last) {
        // Start from the previous stage's values so the monotonic rule holds
        // out of the box and the admin only tweaks deltas.
        Object.assign(next, last, {
          name: "Tân Kỳ",
          linhKhiRequired: Math.round(last.linhKhiRequired * 1.5),
        });
      }
      stages.push(next);
      return d;
    });

  const removeSubStage = (ri: number, si: number) =>
    updateDraft((d) => {
      d[ri].subStages.splice(si, 1);
      return d;
    });

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { realms } = await updateAdminRealms(draft);
      // Re-sync both copies from the server's accepted version.
      setServer(realms);
      setDraft(structuredClone(realms));
      setSavedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lưu thất bại";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      // Draft stays intact — the admin fixes and retries without losing edits.
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, router]);

  const undo = () => {
    if (server) setDraft(structuredClone(server));
    setSaveError(null);
  };

  if (loadError) {
    return (
      <div className="admin-error">
        <span>{loadError}</span>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!draft) return <p>Đang tải cấu hình…</p>;

  const globalError = findError(errors, -1, null, null);
  // Clamp selection defensively (draft can shrink out from under it).
  const ri = Math.min(selectedRealm, draft.length - 1);
  const realm = draft[ri];
  const realmNameError = realm ? findError(errors, ri, null, "name") : null;
  const noStagesError = realm ? findError(errors, ri, null, null) : null;

  // A realm has a validation error if any error targets its index.
  const realmHasError = (index: number) =>
    errors.some((e) => e.realmIndex === index);

  return (
    <section>
      <div className="admin-topbar">
        <h2>Cấu hình cảnh giới</h2>
        <div className="admin-toolbar" style={{ margin: 0 }}>
          <button
            type="button"
            className="admin-btn"
            onClick={undo}
            disabled={!dirty || saving}
          >
            Hoàn tác
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void save()}
            disabled={!dirty || errors.length > 0 || saving}
          >
            {saving ? "Đang lưu…" : "Lưu tất cả"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="admin-error">
          <span>{saveError}</span>
        </div>
      )}
      {globalError && (
        <div className="admin-error">
          <span>{globalError.message}</span>
        </div>
      )}
      {savedAt && !dirty && (
        <p style={{ color: "var(--muted)", marginBottom: "var(--space-3)" }}>
          Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}
        </p>
      )}

      <div className="admin-realm-layout">
        <div className="admin-realm-list">
          {draft.map((r, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: realms are an ordered, index-addressed draft — the index IS the identity the backend stores.
              key={index}
              type="button"
              className="admin-realm-list-item"
              aria-current={index === ri}
              onClick={() => setSelectedRealm(index)}
              disabled={saving}
            >
              <span>
                #{index} — {r.name || "(chưa có tên)"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {realmHasError(index) && <span className="err-dot" />}
                <span className="count">{r.subStages.length}</span>
              </span>
            </button>
          ))}
          <div className="admin-realm-list-foot">
            <button
              type="button"
              className="admin-btn"
              onClick={addRealm}
              disabled={saving}
            >
              + Thêm cảnh giới
            </button>
          </div>
        </div>

        {realm && (
          <div className="admin-realm-detail">
            <div className="admin-substage-card-head">
              <label style={{ flex: 1 }}>
                Tên cảnh giới #{ri}
                <input
                  className={`admin-input${realmNameError ? " invalid" : ""}`}
                  style={{ maxWidth: 320, marginTop: 4 }}
                  value={realm.name}
                  onChange={(e) => setRealmName(ri, e.target.value)}
                  disabled={saving}
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                onClick={() => removeRealm(ri)}
                disabled={saving}
              >
                Xóa cảnh giới
              </button>
            </div>
            {realmNameError && (
              <div className="admin-field-error">{realmNameError.message}</div>
            )}
            {noStagesError && (
              <div className="admin-field-error">{noStagesError.message}</div>
            )}

            {realm.subStages.map((sub, si) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: sub-stages are index-addressed draft rows.
              <div className="admin-substage-card" key={si}>
                <div className="admin-substage-card-head">
                  <label
                    className="admin-substage-field"
                    style={{ flex: 1, maxWidth: 260 }}
                  >
                    Tên tiểu cảnh giới
                    <input
                      className={`admin-input${findError(errors, ri, si, "name") ? " invalid" : ""}`}
                      aria-label={`Tên — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                      value={sub.name}
                      onChange={(e) =>
                        setSubField(ri, si, "name", e.target.value)
                      }
                      disabled={saving}
                    />
                    {findError(errors, ri, si, "name") && (
                      <span className="admin-field-error">
                        {findError(errors, ri, si, "name")?.message}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="admin-btn"
                    aria-label={`Xóa tiểu cảnh giới #${si} của cảnh giới #${ri}`}
                    onClick={() => removeSubStage(ri, si)}
                    disabled={saving}
                  >
                    Xóa
                  </button>
                </div>
                <div className="admin-substage-grid">
                  {NUMERIC_FIELDS.map((f) => {
                    const err = findError(errors, ri, si, f.key);
                    const value = sub[f.key] as number;
                    return (
                      <label className="admin-substage-field" key={f.key}>
                        {f.label}
                        <input
                          type="number"
                          className={`admin-input admin-num${err ? " invalid" : ""}`}
                          aria-label={`${f.label} — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                          value={Number.isNaN(value) ? "" : value}
                          onChange={(e) =>
                            setSubField(ri, si, f.key, e.target.value)
                          }
                          disabled={saving}
                        />
                        {err && (
                          <span className="admin-field-error">
                            {err.message}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div
              className="admin-toolbar"
              style={{ marginTop: "var(--space-4)" }}
            >
              <button
                type="button"
                className="admin-btn"
                onClick={() => addSubStage(ri)}
                disabled={saving}
              >
                + Thêm tiểu cảnh giới
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
