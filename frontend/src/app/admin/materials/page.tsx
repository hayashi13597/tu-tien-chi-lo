"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RarityPips } from "@/components/rarity-pips";
import {
  findAdminCatalogError,
  validateMaterialCatalog,
} from "@/lib/admin-catalog-validation";
import { fetchAdminMaterials, updateAdminMaterials } from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import type { MaterialDTO, PillRarity } from "@/lib/types";

function rarityMeta(rarity: number) {
  const normalized = Math.min(
    Math.max(Number.isFinite(rarity) ? Math.floor(rarity) : 0, 0),
    4,
  ) as PillRarity;
  return getRarityMeta(normalized);
}

function emptyMaterial(index: number): MaterialDTO {
  return {
    id: `nguyen-lieu-moi-${index}`,
    name: "Nguyên liệu mới",
    glyph: "◇",
    rarity: 0,
    tier: 1,
    description: "Mô tả nguyên liệu.",
    active: true,
  };
}

function rangeLabel(material: MaterialDTO): string {
  const meta = rarityMeta(material.rarity);
  return `${meta.name} · ${material.active ? "đang phát hành" : "đang tắt"}`;
}

export default function AdminMaterialsPage() {
  const [server, setServer] = useState<MaterialDTO[] | null>(null);
  const [draft, setDraft] = useState<MaterialDTO[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(server),
    [draft, server],
  );
  const errors = useMemo(
    () => (draft ? validateMaterialCatalog(draft) : []),
    [draft],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { materials } = await fetchAdminMaterials();
      setServer(materials);
      setDraft(structuredClone(materials));
      setSelectedIndex(0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không tải được nguyên liệu";
      if (message === "Authentication expired") {
        window.location.href = "/login";
        return;
      }
      setLoadError(message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateDraft = useCallback(
    (fn: (current: MaterialDTO[]) => MaterialDTO[]) => {
      setDraft((current) => (current ? fn(structuredClone(current)) : current));
    },
    [],
  );

  const setField = (
    index: number,
    field: keyof MaterialDTO,
    value: string | boolean,
  ) => {
    updateDraft((current) => {
      const material = current[index];
      if (!material) return current;
      const nextValue =
        field === "rarity"
          ? value === ""
            ? Number.NaN
            : Number(value)
          : value;
      current[index] = { ...material, [field]: nextValue } as MaterialDTO;
      return current;
    });
  };

  const addMaterial = () => {
    const nextIndex = draft?.length ?? 0;
    updateDraft((current) => {
      current.push(emptyMaterial(nextIndex + 1));
      return current;
    });
    setSelectedIndex(nextIndex);
  };

  const save = useCallback(async () => {
    if (!draft || errors.length > 0) return;
    const selectedId = draft[selectedIndex]?.id;
    setSaving(true);
    setSaveError(null);
    try {
      const { materials } = await updateAdminMaterials(draft);
      setServer(materials);
      setDraft(structuredClone(materials));
      if (selectedId) {
        const nextIndex = materials.findIndex(
          (material) => material.id === selectedId,
        );
        if (nextIndex >= 0) setSelectedIndex(nextIndex);
      }
      setSavedAt(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lưu thất bại";
      if (message === "Authentication expired") {
        window.location.href = "/login";
        return;
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, errors.length, selectedIndex]);

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

  if (!draft) return <p>Đang tải nguyên liệu…</p>;

  const selected =
    draft.length > 0 ? draft[Math.min(selectedIndex, draft.length - 1)] : null;
  const selectedIndexSafe = selected
    ? Math.min(selectedIndex, draft.length - 1)
    : -1;
  const selectedIsExisting =
    selectedIndexSafe >= 0 && selectedIndexSafe < (server?.length ?? 0);
  const selectedMeta = selected ? rarityMeta(selected.rarity) : null;
  const errorFor = (field: string) =>
    selected
      ? findAdminCatalogError(errors, `${selectedIndexSafe}.${field}`)
      : undefined;

  return (
    <section>
      <div className="admin-topbar">
        <h2>Nguyên liệu ({draft.length})</h2>
        <div className="admin-topbar-actions">
          {dirty && <span className="admin-dirty">Có thay đổi chưa lưu</span>}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={addMaterial}
            disabled={saving}
          >
            + Thêm nguyên liệu
          </button>
        </div>
      </div>

      {saveError && <div className="admin-error">{saveError}</div>}
      {errors.length > 0 && (
        <div className="admin-error">
          Có {errors.length} lỗi cần sửa trước khi lưu.
        </div>
      )}
      {savedAt && !dirty && (
        <p className="admin-save-time">
          Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}
        </p>
      )}

      <div className="admin-master-detail">
        <div className="admin-master-list">
          {draft.length === 0 && (
            <p className="admin-master-empty">Chưa có nguyên liệu nào.</p>
          )}
          {draft.map((material, index) => {
            const meta = rarityMeta(material.rarity);
            return (
              <button
                key={`${material.id}-${index}`}
                type="button"
                className={`admin-master-item${material.active ? "" : " inactive"}`}
                aria-current={index === selectedIndexSafe}
                onClick={() => setSelectedIndex(index)}
                disabled={saving}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span
                      className="admin-row-glyph"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    >
                      {material.glyph || "◇"}
                    </span>
                    {material.name || "(chưa có tên)"}
                  </span>
                  <span
                    className={`admin-status admin-status--${material.active ? "ok" : "off"}`}
                  >
                    {material.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={material.rarity} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span className="admin-num">
                    {material.id || "(chưa có ID)"}
                  </span>
                  <span>{rangeLabel(material)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="admin-detail"
          style={
            {
              "--detail-tone": selectedMeta?.color ?? "var(--border-bright)",
            } as CSSProperties
          }
        >
          {selected ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: selectedMeta?.color }}
                  aria-hidden="true"
                >
                  {selected.glyph || "◇"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {selected.name || "(chưa có tên)"}
                  </h3>
                  <div className="admin-chips">
                    <span
                      className="admin-chip admin-chip--tint"
                      style={{ color: selectedMeta?.color }}
                    >
                      {selectedMeta?.name}
                    </span>
                    <span
                      className={`admin-chip admin-chip--${selected.active ? "ok" : "danger"}`}
                    >
                      {selected.active ? "Hoạt động" : "Đang tắt"}
                    </span>
                  </div>
                  <div className="admin-detail-gauge">
                    <RarityPips
                      rarity={selected.rarity}
                      color={selectedMeta?.color ?? "var(--muted)"}
                      size="lg"
                    />
                    <span className="admin-detail-gauge-label">
                      {selectedMeta?.name} · ID{" "}
                      <span className="admin-num">{selected.id}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-form">
                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Nhận dạng</h4>
                    <span className="admin-form-section-hint">
                      ID đã tham chiếu không nên đổi
                    </span>
                  </div>
                  <div className="admin-form-grid">
                    <label className="admin-field">
                      <span className="admin-field-label">ID</span>
                      <input
                        className={`admin-input${errorFor("id") ? " invalid" : ""}`}
                        value={selected.id}
                        onChange={(event) =>
                          setField(selectedIndexSafe, "id", event.target.value)
                        }
                        readOnly={selectedIsExisting}
                        disabled={saving}
                        aria-label="ID nguyên liệu"
                      />
                      <span className="admin-field-hint">
                        Định danh nội bộ, chỉ đặt một lần khi tạo
                      </span>
                      {errorFor("id") && (
                        <span className="admin-field-error">
                          {errorFor("id")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Tên</span>
                      <input
                        className={`admin-input${errorFor("name") ? " invalid" : ""}`}
                        value={selected.name}
                        onChange={(event) =>
                          setField(
                            selectedIndexSafe,
                            "name",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Tên nguyên liệu"
                      />
                      {errorFor("name") && (
                        <span className="admin-field-error">
                          {errorFor("name")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Glyph</span>
                      <input
                        className={`admin-input${errorFor("glyph") ? " invalid" : ""}`}
                        value={selected.glyph}
                        onChange={(event) =>
                          setField(
                            selectedIndexSafe,
                            "glyph",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Glyph nguyên liệu"
                      />
                      {errorFor("glyph") && (
                        <span className="admin-field-error">
                          {errorFor("glyph")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Độ hiếm</span>
                      <input
                        type="number"
                        min={0}
                        className={`admin-input admin-num${errorFor("rarity") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.rarity) ? "" : selected.rarity
                        }
                        onChange={(event) =>
                          setField(
                            selectedIndexSafe,
                            "rarity",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Độ hiếm nguyên liệu"
                      />
                      {errorFor("rarity") && (
                        <span className="admin-field-error">
                          {errorFor("rarity")?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Phát hành</h4>
                    <span className="admin-form-section-hint">
                      Tắt để ẩn khỏi các luồng người chơi mà không mất dữ liệu
                      sở hữu
                    </span>
                  </div>
                  <div className="admin-form-grid">
                    <label className="admin-switch">
                      <input
                        type="checkbox"
                        className="admin-switch-input"
                        checked={selected.active}
                        onChange={(event) =>
                          setField(
                            selectedIndexSafe,
                            "active",
                            event.target.checked,
                          )
                        }
                        disabled={saving}
                      />
                      <span className="admin-switch-track" />
                      <span className="admin-switch-text">
                        <span className="admin-switch-title">
                          Kích hoạt nguyên liệu
                        </span>
                        <span className="admin-field-hint">
                          Nguyên liệu tắt vẫn giữ inventory và có thể bật lại
                        </span>
                      </span>
                    </label>
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field-label">Mô tả</span>
                      <textarea
                        className={`admin-input admin-textarea${errorFor("description") ? " invalid" : ""}`}
                        value={selected.description}
                        onChange={(event) =>
                          setField(
                            selectedIndexSafe,
                            "description",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        rows={3}
                        aria-label="Mô tả nguyên liệu"
                      />
                      {errorFor("description") && (
                        <span className="admin-field-error">
                          {errorFor("description")?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </section>

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
                    Lưu ghi đè toàn bộ catalog nguyên liệu.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Thêm nguyên liệu đầu tiên để bắt đầu catalog.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
