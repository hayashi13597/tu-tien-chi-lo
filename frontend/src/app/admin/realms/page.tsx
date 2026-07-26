"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RealmCurve } from "@/components/realm-curve";
import { fetchAdminRealms, updateAdminRealms } from "@/lib/api";
import { formatNum } from "@/lib/format";
import { findError, validateRealmDraft } from "@/lib/realm-validation";
import type { RealmConfigDTO, SubStageConfigDTO } from "@/lib/types";

// Numeric tunable columns, in display order. name is handled separately.
const SECTIONS: {
  title: string;
  hint: string;
  fields: { key: keyof SubStageConfigDTO; label: string }[];
}[] = [
  {
    title: "Tu luyện",
    hint: "mốc tích đủ mới được phép đột phá",
    fields: [
      { key: "linhKhiRequired", label: "Linh khí cần" },
      { key: "cultivationRate", label: "Tốc độ tu" },
    ],
  },
  {
    title: "Đột phá",
    hint: "tỉ lệ gốc cộng dồn sau mỗi lần thất bại, chặn ở tỉ lệ tối đa",
    fields: [
      { key: "baseSuccessRate", label: "Tỉ lệ gốc (%)" },
      { key: "pityIncrement", label: "Cộng dồn (%)" },
      { key: "maxSuccessRate", label: "Tỉ lệ tối đa (%)" },
      { key: "punishmentSeconds", label: "Phạt (giây)" },
    ],
  },
  {
    title: "Thuộc tính nền",
    hint: "công pháp bị động cộng thêm lên trên các số này",
    fields: [
      { key: "baseKhiHuyet", label: "Khí huyết nền" },
      { key: "baseChanNguyen", label: "Chân nguyên nền" },
      { key: "baseCongVatLy", label: "Công vật lý nền" },
      { key: "baseCongPhep", label: "Công phép nền" },
      { key: "basePhongThu", label: "Phòng thủ nền" },
      { key: "baseTocDo", label: "Tốc độ nền" },
    ],
  },
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
    // Matches the backend's deriveBaseAttributes(cultivationRate = 1).
    baseKhiHuyet: 40,
    baseChanNguyen: 30,
    baseCongVatLy: 6,
    baseCongPhep: 6,
    basePhongThu: 4,
    baseTocDo: 2,
  };
}

function rangeLabel(realm: RealmConfigDTO): string {
  const stages = realm.subStages;
  if (stages.length === 0) return "—";
  const fmt = (v: number) => (Number.isFinite(v) ? formatNum(v) : "?");
  const first = fmt(stages[0].linhKhiRequired);
  return stages.length === 1
    ? first
    : `${first} → ${fmt(stages[stages.length - 1].linhKhiRequired)}`;
}

export default function AdminRealmsPage() {
  const [server, setServer] = useState<RealmConfigDTO[] | null>(null);
  const [draft, setDraft] = useState<RealmConfigDTO[] | null>(null);
  const [selectedRealm, setSelectedRealm] = useState(0);
  const [selectedSub, setSelectedSub] = useState(0);
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

  const addSubStage = (ri: number) => {
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
    setSelectedSub(draft?.[ri]?.subStages.length ?? 0);
  };

  const removeSubStage = (ri: number, si: number) => {
    updateDraft((d) => {
      d[ri].subStages.splice(si, 1);
      return d;
    });
    setSelectedSub((sel) => {
      const remaining = (draft?.[ri]?.subStages.length ?? 1) - 1;
      const next = sel > si ? sel - 1 : sel;
      return Math.max(0, Math.min(next, remaining - 1));
    });
  };

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
  const si = realm ? Math.min(selectedSub, realm.subStages.length - 1) : 0;
  const sub = realm && si >= 0 ? realm.subStages[si] : undefined;
  const subNameError = sub ? findError(errors, ri, si, "name") : null;
  const subHasError = (realmIndex: number, subIndex: number) =>
    errors.some((e) => e.realmIndex === realmIndex && e.subIndex === subIndex);

  // A realm has a validation error if any error targets its index.
  const realmHasError = (index: number) =>
    errors.some((e) => e.realmIndex === index);

  return (
    <section>
      <div className="admin-topbar">
        <h2>Cấu hình cảnh giới</h2>
        {dirty && <span className="admin-dirty">Có thay đổi chưa lưu</span>}
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

      <div className="admin-master-detail">
        <div className="admin-master-list">
          {draft.map((r, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: realms are an ordered, index-addressed draft — the index IS the identity the backend stores.
              key={index}
              type="button"
              className="admin-master-item"
              aria-current={index === ri}
              onClick={() => setSelectedRealm(index)}
              disabled={saving}
            >
              <div className="admin-master-item-top">
                <span className="admin-master-item-name">
                  #{index} — {r.name || "(chưa có tên)"}
                </span>
                {realmHasError(index) && (
                  <span className="admin-status admin-status--danger">Lỗi</span>
                )}
              </div>
              <RealmCurve values={r.subStages.map((s) => s.linhKhiRequired)} />
              <div className="admin-master-item-foot">
                <span>{r.subStages.length} tiểu cảnh giới</span>
                <span className="admin-num">{rangeLabel(r)}</span>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="admin-btn"
            onClick={addRealm}
            disabled={saving}
          >
            + Thêm cảnh giới
          </button>
        </div>

        {realm && (
          <div
            className="admin-detail"
            style={
              {
                "--detail-tone": realmHasError(ri)
                  ? "var(--red)"
                  : "var(--jade)",
              } as CSSProperties
            }
          >
            <div className="admin-detail-head">
              <RealmCurve
                values={realm.subStages.map((s) => s.linhKhiRequired)}
                size="lg"
              />
              <div className="admin-detail-id">
                <input
                  className={`admin-input admin-detail-name-input${realmNameError ? " invalid" : ""}`}
                  value={realm.name}
                  onChange={(e) => setRealmName(ri, e.target.value)}
                  disabled={saving}
                  aria-label={`Tên cảnh giới #${ri}`}
                />
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => removeRealm(ri)}
                  disabled={saving}
                >
                  Xóa cảnh giới
                </button>
              </div>
              <span className="admin-detail-gauge-label">
                Cảnh giới #{ri} · {realm.subStages.length} tiểu cảnh giới ·{" "}
                <span className="admin-num">{rangeLabel(realm)}</span> linh khí
              </span>
            </div>
            {realmNameError && (
              <div className="admin-field-error">{realmNameError.message}</div>
            )}
            {noStagesError && (
              <div className="admin-field-error">{noStagesError.message}</div>
            )}

            <div className="admin-tabs">
              {realm.subStages.map((s, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: tiểu cảnh giới được định danh bằng chỉ số backend
                  key={i}
                  type="button"
                  className="admin-tab"
                  aria-current={i === si}
                  onClick={() => setSelectedSub(i)}
                  disabled={saving}
                >
                  {s.name || `#${i}`}
                  {subHasError(ri, i) && <span className="admin-err-dot" />}
                </button>
              ))}
              <button
                type="button"
                className="admin-tab"
                onClick={() => addSubStage(ri)}
                disabled={saving}
                aria-label="Thêm tiểu cảnh giới"
              >
                +
              </button>
            </div>

            {sub && (
              <>
                <div className="admin-substage-id">
                  <label className="admin-field admin-substage-name">
                    <span className="admin-field-label">
                      Tên tiểu cảnh giới
                    </span>
                    <input
                      className={`admin-input${subNameError ? " invalid" : ""}`}
                      aria-label={`Tên — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                      value={sub.name}
                      onChange={(e) =>
                        setSubField(ri, si, "name", e.target.value)
                      }
                      disabled={saving}
                    />
                    {subNameError && (
                      <span className="admin-field-error">
                        {subNameError.message}
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
                    Xóa tiểu cảnh giới
                  </button>
                </div>
                {SECTIONS.map((section) => (
                  <section className="admin-form-section" key={section.title}>
                    <div className="admin-form-section-head">
                      <h4 className="admin-form-section-title">
                        {section.title}
                      </h4>
                      <span className="admin-form-section-hint">
                        {section.hint}
                      </span>
                    </div>
                    <div className="admin-form-grid">
                      {section.fields.map((f) => {
                        const err = findError(errors, ri, si, f.key);
                        const value = sub[f.key] as number;
                        return (
                          <label className="admin-field" key={f.key}>
                            <span className="admin-field-label">{f.label}</span>
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
                  </section>
                ))}
              </>
            )}

            <div className="admin-form-footer">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => void save()}
                disabled={!dirty || errors.length > 0 || saving}
              >
                {saving ? "Đang lưu…" : "Lưu tất cả"}
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={undo}
                disabled={!dirty || saving}
              >
                Hoàn tác
              </button>
              <span className="admin-field-hint">
                Lưu ghi đè toàn bộ cấu hình cảnh giới, không riêng cảnh giới
                đang chọn.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
