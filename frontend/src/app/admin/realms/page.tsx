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
  const [openRealms, setOpenRealms] = useState<Set<number>>(new Set([0]));
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
  // header links is not intercepted (Next App Router has no route-guard API);
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

  const addRealm = () =>
    updateDraft((d) => {
      d.push({ name: "Cảnh giới mới", subStages: [emptyStage()] });
      return d;
    });

  const removeRealm = (ri: number) => {
    updateDraft((d) => {
      d.splice(ri, 1);
      return d;
    });
    // Expansion state is keyed by index, so realms after the removed one
    // shift down by one — remap the set or their open/closed state would
    // attach to the wrong realm.
    setOpenRealms((s) => {
      const next = new Set<number>();
      for (const i of s) {
        if (i < ri) next.add(i);
        else if (i > ri) next.add(i - 1);
      }
      return next;
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

  const toggleRealm = (ri: number) =>
    setOpenRealms((s) => {
      const next = new Set(s);
      if (next.has(ri)) next.delete(ri);
      else next.add(ri);
      return next;
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

  return (
    <section>
      <div className="admin-toolbar">
        <h2>Cấu hình cảnh giới</h2>
        <button
          type="button"
          className="admin-btn"
          onClick={addRealm}
          disabled={saving}
        >
          + Thêm cảnh giới
        </button>
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
        {savedAt && !dirty && (
          <span>Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}</span>
        )}
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

      {draft.map((realm, ri) => {
        const realmNameError = findError(errors, ri, null, "name");
        const noStagesError = findError(errors, ri, null, null);
        const open = openRealms.has(ri);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: realms are an ordered, index-addressed draft — the index IS the identity the backend stores.
          <div className="admin-realm" key={ri}>
            <button
              type="button"
              className="admin-realm-head"
              aria-expanded={open}
              onClick={() => toggleRealm(ri)}
            >
              <span>
                #{ri} — {realm.name || "(chưa có tên)"} ·{" "}
                {realm.subStages.length} tiểu cảnh giới
              </span>
              <span>{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="admin-realm-body">
                <label>
                  Tên cảnh giới{" "}
                  <input
                    className={`admin-input${realmNameError ? " invalid" : ""}`}
                    style={{ maxWidth: 260 }}
                    value={realm.name}
                    onChange={(e) => setRealmName(ri, e.target.value)}
                    disabled={saving}
                  />
                </label>
                {realmNameError && (
                  <div className="admin-field-error">
                    {realmNameError.message}
                  </div>
                )}
                {noStagesError && (
                  <div className="admin-field-error">
                    {noStagesError.message}
                  </div>
                )}

                <div className="admin-realm-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        {NUMERIC_FIELDS.map((f) => (
                          <th key={f.key}>{f.label}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {realm.subStages.map((sub, si) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: sub-stages are index-addressed draft rows.
                        <tr key={si}>
                          <td>
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
                              <div className="admin-field-error">
                                {findError(errors, ri, si, "name")?.message}
                              </div>
                            )}
                          </td>
                          {NUMERIC_FIELDS.map((f) => {
                            const err = findError(errors, ri, si, f.key);
                            const value = sub[f.key] as number;
                            return (
                              <td key={f.key}>
                                <input
                                  type="number"
                                  className={`admin-input${err ? " invalid" : ""}`}
                                  aria-label={`${f.label} — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                                  value={Number.isNaN(value) ? "" : value}
                                  onChange={(e) =>
                                    setSubField(ri, si, f.key, e.target.value)
                                  }
                                  disabled={saving}
                                />
                                {err && (
                                  <div className="admin-field-error">
                                    {err.message}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td>
                            <button
                              type="button"
                              className="admin-btn"
                              aria-label={`Xóa tiểu cảnh giới #${si} của cảnh giới #${ri}`}
                              onClick={() => removeSubStage(ri, si)}
                              disabled={saving}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-toolbar" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => addSubStage(ri)}
                    disabled={saving}
                  >
                    + Thêm tiểu cảnh giới
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => removeRealm(ri)}
                    disabled={saving}
                  >
                    Xóa cảnh giới này
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
