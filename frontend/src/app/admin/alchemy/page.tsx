"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { RarityPips } from "@/components/rarity-pips";
import {
  findAdminCatalogError,
  validateAlchemyRecipes,
} from "@/lib/admin-catalog-validation";
import {
  fetchAdminAlchemyRecipes,
  fetchAdminMaterials,
  fetchAdminPills,
  updateAdminAlchemyRecipes,
} from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import type {
  AdminPillDTO,
  AlchemyRecipeDTO,
  MaterialDTO,
  PillRarity,
} from "@/lib/types";

function rarityMeta(rarity: number) {
  const normalized = Math.min(
    Math.max(Number.isFinite(rarity) ? Math.floor(rarity) : 0, 0),
    4,
  ) as PillRarity;
  return getRarityMeta(normalized);
}

function emptyRecipe(
  index: number,
  pills: AdminPillDTO[],
  materials: MaterialDTO[],
): AlchemyRecipeDTO {
  return {
    id: `cong-thuc-moi-${index}`,
    pillId: pills[0]?.id ?? "",
    durationSec: 1800,
    linhThachCost: 0,
    active: true,
    ingredients: materials[0]
      ? [{ materialId: materials[0].id, quantity: 1 }]
      : [],
    // Backend mặc định khi thiếu: tier 1, rank 1, deterministic 100%.
    tier: 1,
    minAlchemyRank: 1,
    baseSuccessPct: 100,
  };
}

function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return "?";
  if (seconds % 3600 === 0) return `${seconds / 3600} giờ`;
  if (seconds % 60 === 0) return `${seconds / 60} phút`;
  return `${seconds} giây`;
}

export default function AdminAlchemyPage() {
  const [server, setServer] = useState<AlchemyRecipeDTO[] | null>(null);
  const [draft, setDraft] = useState<AlchemyRecipeDTO[] | null>(null);
  const [pills, setPills] = useState<AdminPillDTO[]>([]);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
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
    () => (draft ? validateAlchemyRecipes(draft) : []),
    [draft],
  );

  const pillById = useMemo(
    () => new Map(pills.map((pill) => [pill.id, pill])),
    [pills],
  );
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [
        { recipes },
        { pills: loadedPills },
        { materials: loadedMaterials },
      ] = await Promise.all([
        fetchAdminAlchemyRecipes(),
        fetchAdminPills(),
        fetchAdminMaterials(),
      ]);
      setServer(recipes);
      setDraft(structuredClone(recipes));
      setPills(loadedPills);
      setMaterials(loadedMaterials);
      setSelectedIndex(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không tải được công thức luyện đan";
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
    (fn: (current: AlchemyRecipeDTO[]) => AlchemyRecipeDTO[]) => {
      setDraft((current) => (current ? fn(structuredClone(current)) : current));
    },
    [],
  );

  const setRecipeField = (
    index: number,
    field: keyof AlchemyRecipeDTO,
    value: string | boolean,
  ) => {
    updateDraft((current) => {
      const recipe = current[index];
      if (!recipe) return current;
      const nextValue =
        field === "durationSec" ||
        field === "linhThachCost" ||
        field === "tier" ||
        field === "minAlchemyRank" ||
        field === "baseSuccessPct"
          ? value === ""
            ? Number.NaN
            : Number(value)
          : value;
      current[index] = { ...recipe, [field]: nextValue } as AlchemyRecipeDTO;
      return current;
    });
  };

  const setIngredient = (
    recipeIndex: number,
    ingredientIndex: number,
    field: "materialId" | "quantity",
    value: string,
  ) => {
    updateDraft((current) => {
      const ingredient = current[recipeIndex]?.ingredients[ingredientIndex];
      if (!ingredient) return current;
      if (field === "quantity") {
        ingredient.quantity = value === "" ? Number.NaN : Number(value);
      } else {
        ingredient.materialId = value;
      }
      return current;
    });
  };

  const addIngredient = (recipeIndex: number) => {
    const firstMaterial = materials[0];
    if (!firstMaterial) return;
    updateDraft((current) => {
      const recipe = current[recipeIndex];
      if (recipe)
        recipe.ingredients.push({ materialId: firstMaterial.id, quantity: 1 });
      return current;
    });
  };

  const removeIngredient = (recipeIndex: number, ingredientIndex: number) => {
    updateDraft((current) => {
      const recipe = current[recipeIndex];
      if (recipe) recipe.ingredients.splice(ingredientIndex, 1);
      return current;
    });
  };

  const addRecipe = () => {
    if (pills.length === 0 || materials.length === 0) return;
    const nextIndex = draft?.length ?? 0;
    updateDraft((current) => {
      const usedPills = new Set(current.map((recipe) => recipe.pillId));
      const availablePill = pills.find((pill) => !usedPills.has(pill.id));
      if (!availablePill) return current;
      current.push({
        ...emptyRecipe(nextIndex + 1, pills, materials),
        pillId: availablePill.id,
      });
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
      const { recipes } = await updateAdminAlchemyRecipes(draft);
      setServer(recipes);
      setDraft(structuredClone(recipes));
      if (selectedId) {
        const nextIndex = recipes.findIndex(
          (recipe) => recipe.id === selectedId,
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

  if (!draft) return <p>Đang tải công thức luyện đan…</p>;

  const selected =
    draft.length > 0 ? draft[Math.min(selectedIndex, draft.length - 1)] : null;
  const selectedIndexSafe = selected
    ? Math.min(selectedIndex, draft.length - 1)
    : -1;
  const selectedIsExisting =
    selectedIndexSafe >= 0 && selectedIndexSafe < (server?.length ?? 0);
  const outputPill = selected ? pillById.get(selected.pillId) : undefined;
  const outputMeta = outputPill ? rarityMeta(outputPill.rarity) : null;
  const errorFor = (field: string) =>
    selected
      ? findAdminCatalogError(errors, `${selectedIndexSafe}.${field}`)
      : undefined;
  const dependencyError = pills.length === 0 || materials.length === 0;
  const hasAvailablePill = pills.some(
    (pill) => !draft.some((recipe) => recipe.pillId === pill.id),
  );

  return (
    <section>
      <div className="admin-topbar">
        <h2>Luyện đan ({draft.length})</h2>
        <div className="admin-topbar-actions">
          {dirty && <span className="admin-dirty">Có thay đổi chưa lưu</span>}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={addRecipe}
            disabled={saving || dependencyError || !hasAvailablePill}
          >
            + Thêm công thức
          </button>
        </div>
      </div>

      {dependencyError && (
        <div className="admin-error">
          Cần có ít nhất một đan dược và một nguyên liệu trước khi tạo công
          thức.
        </div>
      )}
      {!dependencyError && !hasAvailablePill && (
        <div className="admin-error">
          Mỗi đan dược chỉ có một công thức; thêm đan dược mới nếu cần mở rộng
          catalog.
        </div>
      )}
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
            <p className="admin-master-empty">Chưa có công thức nào.</p>
          )}
          {draft.map((recipe, index) => {
            const pill = pillById.get(recipe.pillId);
            const meta = pill ? rarityMeta(pill.rarity) : rarityMeta(0);
            return (
              <button
                key={`${recipe.id}-${index}`}
                type="button"
                className={`admin-master-item${recipe.active ? "" : " inactive"}`}
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
                      {pill?.glyph || "⚗"}
                    </span>
                    {pill?.name || recipe.pillId || "(chưa chọn đan dược)"}
                  </span>
                  <span
                    className={`admin-status admin-status--${recipe.active ? "ok" : "off"}`}
                  >
                    {recipe.active ? "Hoạt động" : "Đang tắt"}
                  </span>
                </div>
                <RarityPips rarity={pill?.rarity ?? 0} color={meta.color} />
                <div className="admin-master-item-foot">
                  <span>{recipe.ingredients.length} nguyên liệu</span>
                  <span className="admin-num">
                    {durationLabel(recipe.durationSec)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="admin-detail"
          style={
            {
              "--detail-tone": outputMeta?.color ?? "var(--border-bright)",
            } as CSSProperties
          }
        >
          {selected ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span
                  className="admin-detail-glyph"
                  style={{ color: outputMeta?.color ?? "var(--gold)" }}
                  aria-hidden="true"
                >
                  {outputPill?.glyph || "⚗"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {outputPill?.name || selected.pillId || "Công thức mới"}
                  </h3>
                  <div className="admin-chips">
                    {outputMeta && (
                      <span
                        className="admin-chip admin-chip--tint"
                        style={{ color: outputMeta.color }}
                      >
                        {outputMeta.name}
                      </span>
                    )}
                    <span className="admin-chip">
                      {selected.ingredients.length} nguyên liệu
                    </span>
                    <span
                      className={`admin-chip admin-chip--${selected.active ? "ok" : "danger"}`}
                    >
                      {selected.active ? "Hoạt động" : "Đang tắt"}
                    </span>
                  </div>
                  <span className="admin-detail-gauge-label">
                    <span className="admin-num">
                      {durationLabel(selected.durationSec)}
                    </span>
                    {" · "}
                    <span className="admin-num">{selected.linhThachCost}</span>{" "}
                    Linh Thạch
                  </span>
                </div>
              </div>

              <div className="admin-form">
                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Cấu hình mẻ</h4>
                    <span className="admin-form-section-hint">
                      Một công thức cho ra đúng một loại đan dược
                    </span>
                  </div>
                  <div className="admin-form-grid">
                    <label className="admin-field">
                      <span className="admin-field-label">ID</span>
                      <input
                        className={`admin-input${errorFor("id") ? " invalid" : ""}`}
                        value={selected.id}
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "id",
                            event.target.value,
                          )
                        }
                        readOnly={selectedIsExisting}
                        disabled={saving}
                        aria-label="ID công thức"
                      />
                      <span className="admin-field-hint">
                        Định danh nội bộ, không đổi sau khi tạo
                      </span>
                      {errorFor("id") && (
                        <span className="admin-field-error">
                          {errorFor("id")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Đan dược đầu ra</span>
                      <select
                        className={`admin-input${errorFor("pillId") ? " invalid" : ""}`}
                        value={selected.pillId}
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "pillId",
                            event.target.value,
                          )
                        }
                        disabled={saving || pills.length === 0}
                        aria-label="Đan dược đầu ra"
                      >
                        {pills.length === 0 && (
                          <option value="">Chưa có đan dược</option>
                        )}
                        {pills.map((pill) => (
                          <option key={pill.id} value={pill.id}>
                            {pill.name} {pill.active ? "" : "(đã tắt)"}
                          </option>
                        ))}
                      </select>
                      {errorFor("pillId") && (
                        <span className="admin-field-error">
                          {errorFor("pillId")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Thời gian (giây)
                      </span>
                      <input
                        type="number"
                        min={1}
                        className={`admin-input admin-num${errorFor("durationSec") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.durationSec)
                            ? ""
                            : selected.durationSec
                        }
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "durationSec",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Thời gian luyện đan"
                      />
                      {errorFor("durationSec") && (
                        <span className="admin-field-error">
                          {errorFor("durationSec")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Chi phí Linh Thạch
                      </span>
                      <input
                        type="number"
                        min={0}
                        className={`admin-input admin-num${errorFor("linhThachCost") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.linhThachCost)
                            ? ""
                            : selected.linhThachCost
                        }
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "linhThachCost",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Chi phí Linh Thạch"
                      />
                      {errorFor("linhThachCost") && (
                        <span className="admin-field-error">
                          {errorFor("linhThachCost")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Bậc công thức</span>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        className={`admin-input admin-num${errorFor("tier") ? " invalid" : ""}`}
                        value={Number.isNaN(selected.tier) ? "" : selected.tier}
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "tier",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Bậc công thức"
                      />
                      <span className="admin-field-hint">
                        1 Phàm Giai · 2 Linh Giai · 3 Thiên Giai
                      </span>
                      {errorFor("tier") && (
                        <span className="admin-field-error">
                          {errorFor("tier")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Cấp Đan Sư tối thiểu
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        className={`admin-input admin-num${errorFor("minAlchemyRank") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.minAlchemyRank)
                            ? ""
                            : selected.minAlchemyRank
                        }
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "minAlchemyRank",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Cấp Đan Sư tối thiểu"
                      />
                      <span className="admin-field-hint">
                        Gắn theo bậc: 1 → cấp 1, 2 → cấp 4, 3 → cấp 7
                      </span>
                      {errorFor("minAlchemyRank") && (
                        <span className="admin-field-error">
                          {errorFor("minAlchemyRank")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Tỉ lệ thành công cơ bản (%)
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        className={`admin-input admin-num${errorFor("baseSuccessPct") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.baseSuccessPct)
                            ? ""
                            : selected.baseSuccessPct
                        }
                        onChange={(event) =>
                          setRecipeField(
                            selectedIndexSafe,
                            "baseSuccessPct",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Tỉ lệ thành công cơ bản (%)"
                      />
                      <span className="admin-field-hint">
                        100 = luôn thành công như hệ cũ
                      </span>
                      {errorFor("baseSuccessPct") && (
                        <span className="admin-field-error">
                          {errorFor("baseSuccessPct")?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">
                      Nguyên liệu đầu vào
                    </h4>
                    <span className="admin-form-section-hint">
                      Mỗi nguyên liệu chỉ xuất hiện một lần trong công thức
                    </span>
                  </div>
                  <div className="admin-row-list">
                    {selected.ingredients.length === 0 && (
                      <p className="admin-row-empty">
                        Cần thêm ít nhất một nguyên liệu.
                      </p>
                    )}
                    {selected.ingredients.map((ingredient, ingredientIndex) => {
                      const materialError = findAdminCatalogError(
                        errors,
                        `${selectedIndexSafe}.ingredients.${ingredientIndex}.materialId`,
                      );
                      const quantityError = findAdminCatalogError(
                        errors,
                        `${selectedIndexSafe}.ingredients.${ingredientIndex}.quantity`,
                      );
                      return (
                        <div
                          className="admin-row"
                          key={`${ingredient.materialId}-${ingredientIndex}`}
                        >
                          <label className="admin-row-grow">
                            <span className="admin-field-label">
                              Nguyên liệu
                            </span>
                            <select
                              className={`admin-input${materialError ? " invalid" : ""}`}
                              value={ingredient.materialId}
                              onChange={(event) =>
                                setIngredient(
                                  selectedIndexSafe,
                                  ingredientIndex,
                                  "materialId",
                                  event.target.value,
                                )
                              }
                              disabled={saving || materials.length === 0}
                              aria-label={`Nguyên liệu đầu vào #${ingredientIndex + 1}`}
                            >
                              {materials.length === 0 && (
                                <option value="">Chưa có nguyên liệu</option>
                              )}
                              {materials.map((material) => (
                                <option key={material.id} value={material.id}>
                                  {material.glyph} {material.name}{" "}
                                  {material.active ? "" : "(đã tắt)"}
                                </option>
                              ))}
                            </select>
                            {materialError && (
                              <span className="admin-field-error">
                                {materialError.message}
                              </span>
                            )}
                          </label>
                          <label className="admin-row-field">
                            Số lượng
                            <input
                              type="number"
                              min={1}
                              className={`admin-input admin-row-num${quantityError ? " invalid" : ""}`}
                              value={
                                Number.isNaN(ingredient.quantity)
                                  ? ""
                                  : ingredient.quantity
                              }
                              onChange={(event) =>
                                setIngredient(
                                  selectedIndexSafe,
                                  ingredientIndex,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              disabled={saving}
                              aria-label={`Số lượng nguyên liệu #${ingredientIndex + 1}`}
                            />
                            {quantityError && (
                              <span className="admin-field-error">
                                {quantityError.message}
                              </span>
                            )}
                          </label>
                          <button
                            type="button"
                            className="admin-btn admin-row-remove"
                            onClick={() =>
                              removeIngredient(
                                selectedIndexSafe,
                                ingredientIndex,
                              )
                            }
                            disabled={saving}
                            aria-label={`Xóa nguyên liệu #${ingredientIndex + 1}`}
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
                    onClick={() => addIngredient(selectedIndexSafe)}
                    disabled={saving || materials.length === 0}
                  >
                    + Thêm nguyên liệu
                  </button>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Phát hành</h4>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      className="admin-switch-input"
                      checked={selected.active}
                      onChange={(event) =>
                        setRecipeField(
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
                        Kích hoạt công thức
                      </span>
                      <span className="admin-field-hint">
                        Công thức tắt không xuất hiện trong phòng luyện đan.
                      </span>
                    </span>
                  </label>
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
                    Lưu ghi đè toàn bộ catalog công thức.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Thêm công thức đầu tiên sau khi có đan dược và nguyên liệu.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
