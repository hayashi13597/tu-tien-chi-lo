"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import {
  findAdminCatalogError,
  validateExpeditionConfig,
} from "@/lib/admin-catalog-validation";
import {
  fetchAdminExpeditions,
  fetchAdminMaterials,
  updateAdminExpeditions,
} from "@/lib/api";
import { formatNum } from "@/lib/format";
import type {
  ExpeditionBranchDTO,
  ExpeditionDifficultyDTO,
  ExpeditionDifficultyKey,
  MaterialDTO,
} from "@/lib/types";

const DIFFICULTIES: {
  key: ExpeditionDifficultyKey;
  label: string;
}[] = [
  { key: "easy", label: "Dễ" },
  { key: "normal", label: "Thường" },
  { key: "hard", label: "Khó" },
];

function emptyDifficulty(
  key: ExpeditionDifficultyKey,
): ExpeditionDifficultyDTO {
  const defaults: Record<ExpeditionDifficultyKey, ExpeditionDifficultyDTO> = {
    easy: {
      key,
      enemyMultiplier: 0.8,
      normalDropRate: 0.5,
      bossDropRate: 0.8,
      rewardMultiplier: 0.25,
      adaptiveCoefficient: 0.5,
    },
    normal: {
      key,
      enemyMultiplier: 1,
      normalDropRate: 0.4,
      bossDropRate: 0.7,
      rewardMultiplier: 0.5,
      adaptiveCoefficient: 0.75,
    },
    hard: {
      key,
      enemyMultiplier: 1.5,
      normalDropRate: 0.3,
      bossDropRate: 0.6,
      rewardMultiplier: 1,
      adaptiveCoefficient: 1,
    },
  };
  return { ...defaults[key] };
}

function emptyBranch(
  index: number,
  materials: MaterialDTO[],
): ExpeditionBranchDTO {
  const materialId = materials[0]?.id ?? "";
  return {
    branch: {
      id: `bi-canh-moi-${index}`,
      name: "Bí cảnh mới",
      glyph: "◇",
      description: "Mô tả bí cảnh.",
      basePower: 100,
      alchemyMaterialId: materialId,
      upgradeMaterialWeights: materialId ? [{ materialId, weight: 1 }] : [],
    },
    difficulties: DIFFICULTIES.map(({ key }) => emptyDifficulty(key)),
  };
}

function difficultyLabel(key: ExpeditionDifficultyKey): string {
  return (
    DIFFICULTIES.find((difficulty) => difficulty.key === key)?.label ?? key
  );
}

export default function AdminExpeditionsPage() {
  const [server, setServer] = useState<ExpeditionBranchDTO[] | null>(null);
  const [draft, setDraft] = useState<ExpeditionBranchDTO[] | null>(null);
  const [materials, setMaterials] = useState<MaterialDTO[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<ExpeditionDifficultyKey>("easy");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(server),
    [draft, server],
  );
  const errors = useMemo(
    () => (draft ? validateExpeditionConfig(draft) : []),
    [draft],
  );
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [{ branches }, { materials: loadedMaterials }] = await Promise.all([
        fetchAdminExpeditions(),
        fetchAdminMaterials(),
      ]);
      setServer(branches);
      setDraft(structuredClone(branches));
      setMaterials(loadedMaterials);
      setSelectedIndex(0);
      setSelectedDifficulty("easy");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không tải được cấu hình bí cảnh";
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
    (fn: (current: ExpeditionBranchDTO[]) => ExpeditionBranchDTO[]) => {
      setDraft((current) => (current ? fn(structuredClone(current)) : current));
    },
    [],
  );

  const setBranchField = (
    index: number,
    field:
      | "id"
      | "name"
      | "glyph"
      | "description"
      | "basePower"
      | "alchemyMaterialId",
    value: string,
  ) => {
    updateDraft((current) => {
      const branch = current[index]?.branch;
      if (!branch) return current;
      if (field === "basePower") {
        branch.basePower = value === "" ? Number.NaN : Number(value);
      } else {
        branch[field] = value;
      }
      return current;
    });
  };

  const setWeight = (
    branchIndex: number,
    weightIndex: number,
    field: "materialId" | "weight",
    value: string,
  ) => {
    updateDraft((current) => {
      const weight =
        current[branchIndex]?.branch.upgradeMaterialWeights[weightIndex];
      if (!weight) return current;
      if (field === "weight") {
        weight.weight = value === "" ? Number.NaN : Number(value);
      } else {
        weight.materialId = value;
      }
      return current;
    });
  };

  const setDifficultyField = (
    branchIndex: number,
    difficultyKey: ExpeditionDifficultyKey,
    field:
      | "enemyMultiplier"
      | "normalDropRate"
      | "bossDropRate"
      | "rewardMultiplier"
      | "adaptiveCoefficient",
    value: string,
  ) => {
    updateDraft((current) => {
      const difficulty = current[branchIndex]?.difficulties.find(
        (item) => item.key === difficultyKey,
      );
      if (!difficulty) return current;
      difficulty[field] = value === "" ? Number.NaN : Number(value);
      return current;
    });
  };

  const addWeight = (branchIndex: number) => {
    const firstMaterial = materials[0];
    if (!firstMaterial) return;
    updateDraft((current) => {
      const weights = current[branchIndex]?.branch.upgradeMaterialWeights;
      if (weights) weights.push({ materialId: firstMaterial.id, weight: 1 });
      return current;
    });
  };

  const removeWeight = (branchIndex: number, weightIndex: number) => {
    updateDraft((current) => {
      current[branchIndex]?.branch.upgradeMaterialWeights.splice(
        weightIndex,
        1,
      );
      return current;
    });
  };

  const addBranch = () => {
    if (materials.length === 0) return;
    const nextIndex = draft?.length ?? 0;
    updateDraft((current) => {
      current.push(emptyBranch(nextIndex + 1, materials));
      return current;
    });
    setSelectedIndex(nextIndex);
    setSelectedDifficulty("easy");
  };

  const save = useCallback(async () => {
    if (!draft || errors.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { branches } = await updateAdminExpeditions(draft);
      setServer(branches);
      setDraft(structuredClone(branches));
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
  }, [draft, errors.length]);

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

  if (!draft) return <p>Đang tải cấu hình bí cảnh…</p>;

  const selected =
    draft.length > 0 ? draft[Math.min(selectedIndex, draft.length - 1)] : null;
  const selectedIndexSafe = selected
    ? Math.min(selectedIndex, draft.length - 1)
    : -1;
  const selectedIsExisting =
    selectedIndexSafe >= 0 && selectedIndexSafe < (server?.length ?? 0);
  const selectedDifficultyIndex = selected
    ? selected.difficulties.findIndex((item) => item.key === selectedDifficulty)
    : -1;
  const difficulty =
    selected && selectedDifficultyIndex >= 0
      ? selected.difficulties[selectedDifficultyIndex]
      : null;
  const maxBasePower = Math.max(
    1,
    ...draft.map((bundle) =>
      Number.isFinite(bundle.branch.basePower) ? bundle.branch.basePower : 0,
    ),
  );
  const branchError = (field: string) =>
    selected
      ? findAdminCatalogError(errors, `${selectedIndexSafe}.branch.${field}`)
      : undefined;
  const weightError = (weightIndex: number, field: string) =>
    findAdminCatalogError(
      errors,
      `${selectedIndexSafe}.branch.upgradeMaterialWeights.${weightIndex}.${field}`,
    );
  const difficultyError = (field: string) =>
    selectedDifficultyIndex >= 0
      ? findAdminCatalogError(
          errors,
          `${selectedIndexSafe}.difficulties.${selectedDifficultyIndex}.${field}`,
        )
      : undefined;
  const branchHasError = (index: number) =>
    errors.some((error) => error.path.startsWith(`${index}.`));

  return (
    <section>
      <div className="admin-topbar">
        <h2>Cấu hình bí cảnh ({draft.length})</h2>
        <div className="admin-topbar-actions">
          {dirty && <span className="admin-dirty">Có thay đổi chưa lưu</span>}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={addBranch}
            disabled={saving || materials.length === 0}
          >
            + Thêm bí cảnh
          </button>
        </div>
      </div>

      {materials.length === 0 && (
        <div className="admin-error">
          Cần có ít nhất một nguyên liệu trước khi tạo hoặc chỉnh drop của bí
          cảnh.
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
            <p className="admin-master-empty">Chưa có bí cảnh nào.</p>
          )}
          {draft.map((bundle, index) => {
            const error = branchHasError(index);
            const width = Math.max(
              2,
              Math.min(100, (bundle.branch.basePower / maxBasePower) * 100),
            );
            return (
              <button
                key={`${bundle.branch.id}-${index}`}
                type="button"
                className="admin-master-item"
                aria-current={index === selectedIndexSafe}
                onClick={() => {
                  setSelectedIndex(index);
                  setSelectedDifficulty("easy");
                }}
                disabled={saving}
              >
                <div className="admin-master-item-top">
                  <span className="admin-master-item-name">
                    <span className="admin-row-glyph" aria-hidden="true">
                      {bundle.branch.glyph || "◇"}
                    </span>
                    {bundle.branch.name || "(chưa có tên)"}
                  </span>
                  {error && (
                    <span className="admin-status admin-status--danger">
                      Lỗi
                    </span>
                  )}
                </div>
                <div className="admin-meter">
                  <div
                    className="admin-meter-fill"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="admin-master-item-foot">
                  <span>{bundle.difficulties.length} độ khó</span>
                  <span className="admin-num">
                    Lực nền {formatNum(bundle.branch.basePower)}
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
              "--detail-tone":
                selected && branchHasError(selectedIndexSafe)
                  ? "var(--red)"
                  : "var(--jade)",
            } as CSSProperties
          }
        >
          {selected ? (
            <>
              <div className="admin-detail-head admin-detail-head--row">
                <span className="admin-detail-glyph" aria-hidden="true">
                  {selected.branch.glyph || "◇"}
                </span>
                <div className="admin-detail-head-main">
                  <h3 className="admin-detail-title">
                    {selected.branch.name || "Bí cảnh mới"}
                  </h3>
                  <div className="admin-chips">
                    <span className="admin-chip">
                      {selected.difficulties.length} độ khó
                    </span>
                    <span className="admin-chip">
                      Lực nền{" "}
                      <span className="admin-num">
                        {formatNum(selected.branch.basePower)}
                      </span>
                    </span>
                    {branchHasError(selectedIndexSafe) && (
                      <span className="admin-chip admin-chip--danger">
                        Cần kiểm tra
                      </span>
                    )}
                  </div>
                  <span className="admin-detail-gauge-label">
                    Nhánh{" "}
                    <span className="admin-num">{selected.branch.id}</span> ·
                    drop nguyên liệu và hệ số theo độ khó
                  </span>
                </div>
              </div>

              <div className="admin-form">
                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Nhận dạng</h4>
                    <span className="admin-form-section-hint">
                      Cấu hình nền của một nhánh bí cảnh
                    </span>
                  </div>
                  <div className="admin-form-grid">
                    <label className="admin-field">
                      <span className="admin-field-label">ID</span>
                      <input
                        className={`admin-input${branchError("id") ? " invalid" : ""}`}
                        value={selected.branch.id}
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "id",
                            event.target.value,
                          )
                        }
                        readOnly={selectedIsExisting}
                        disabled={saving}
                        aria-label="ID bí cảnh"
                      />
                      <span className="admin-field-hint">
                        Định danh nội bộ, không đổi sau khi tạo
                      </span>
                      {branchError("id") && (
                        <span className="admin-field-error">
                          {branchError("id")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Tên</span>
                      <input
                        className={`admin-input${branchError("name") ? " invalid" : ""}`}
                        value={selected.branch.name}
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "name",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Tên bí cảnh"
                      />
                      {branchError("name") && (
                        <span className="admin-field-error">
                          {branchError("name")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Glyph</span>
                      <input
                        className={`admin-input${branchError("glyph") ? " invalid" : ""}`}
                        value={selected.branch.glyph}
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "glyph",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Glyph bí cảnh"
                      />
                      {branchError("glyph") && (
                        <span className="admin-field-error">
                          {branchError("glyph")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">Lực nền</span>
                      <input
                        type="number"
                        min={0}
                        className={`admin-input admin-num${branchError("basePower") ? " invalid" : ""}`}
                        value={
                          Number.isNaN(selected.branch.basePower)
                            ? ""
                            : selected.branch.basePower
                        }
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "basePower",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        aria-label="Lực nền bí cảnh"
                      />
                      {branchError("basePower") && (
                        <span className="admin-field-error">
                          {branchError("basePower")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field">
                      <span className="admin-field-label">
                        Nguyên liệu luyện đan
                      </span>
                      <select
                        className={`admin-input${branchError("alchemyMaterialId") ? " invalid" : ""}`}
                        value={selected.branch.alchemyMaterialId}
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "alchemyMaterialId",
                            event.target.value,
                          )
                        }
                        disabled={saving || materials.length === 0}
                        aria-label="Nguyên liệu luyện đan của bí cảnh"
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
                      <span className="admin-field-hint">
                        Vật liệu riêng của nhánh, rơi theo kết quả chuyến đi.
                      </span>
                      {branchError("alchemyMaterialId") && (
                        <span className="admin-field-error">
                          {branchError("alchemyMaterialId")?.message}
                        </span>
                      )}
                    </label>
                    <label className="admin-field admin-field--wide">
                      <span className="admin-field-label">Mô tả</span>
                      <textarea
                        className={`admin-input admin-textarea${branchError("description") ? " invalid" : ""}`}
                        value={selected.branch.description}
                        onChange={(event) =>
                          setBranchField(
                            selectedIndexSafe,
                            "description",
                            event.target.value,
                          )
                        }
                        disabled={saving}
                        rows={3}
                        aria-label="Mô tả bí cảnh"
                      />
                      {branchError("description") && (
                        <span className="admin-field-error">
                          {branchError("description")?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">
                      Nguyên liệu nâng cấp
                    </h4>
                    <span className="admin-form-section-hint">
                      Trọng số tương đối; không cần cộng đúng bằng 1
                    </span>
                  </div>
                  <div className="admin-row-list">
                    {selected.branch.upgradeMaterialWeights.length === 0 && (
                      <p className="admin-row-empty">
                        Cần thêm ít nhất một trọng số.
                      </p>
                    )}
                    {selected.branch.upgradeMaterialWeights.map(
                      (weight, weightIndex) => {
                        const materialError = weightError(
                          weightIndex,
                          "materialId",
                        );
                        const valueError = weightError(weightIndex, "weight");
                        return (
                          <div
                            className="admin-row"
                            key={`${weight.materialId}-${weightIndex}`}
                          >
                            <label className="admin-row-grow">
                              <span className="admin-field-label">
                                Nguyên liệu
                              </span>
                              <select
                                className={`admin-input${materialError ? " invalid" : ""}`}
                                value={weight.materialId}
                                onChange={(event) =>
                                  setWeight(
                                    selectedIndexSafe,
                                    weightIndex,
                                    "materialId",
                                    event.target.value,
                                  )
                                }
                                disabled={saving || materials.length === 0}
                                aria-label={`Nguyên liệu nâng cấp #${weightIndex + 1}`}
                              >
                                {materials.length === 0 && (
                                  <option value="">Chưa có nguyên liệu</option>
                                )}
                                {materials.map((material) => (
                                  <option key={material.id} value={material.id}>
                                    {material.glyph} {material.name}
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
                              Trọng số
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                className={`admin-input admin-row-num${valueError ? " invalid" : ""}`}
                                value={
                                  Number.isNaN(weight.weight)
                                    ? ""
                                    : weight.weight
                                }
                                onChange={(event) =>
                                  setWeight(
                                    selectedIndexSafe,
                                    weightIndex,
                                    "weight",
                                    event.target.value,
                                  )
                                }
                                disabled={saving}
                                aria-label={`Trọng số nguyên liệu #${weightIndex + 1}`}
                              />
                              {valueError && (
                                <span className="admin-field-error">
                                  {valueError.message}
                                </span>
                              )}
                            </label>
                            <button
                              type="button"
                              className="admin-btn admin-row-remove"
                              onClick={() =>
                                removeWeight(selectedIndexSafe, weightIndex)
                              }
                              disabled={saving}
                              aria-label={`Xóa trọng số #${weightIndex + 1}`}
                            >
                              <CloseIcon width={16} height={16} />
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-row-add"
                    onClick={() => addWeight(selectedIndexSafe)}
                    disabled={saving || materials.length === 0}
                  >
                    + Thêm trọng số
                  </button>
                </section>

                <section className="admin-form-section">
                  <div className="admin-form-section-head">
                    <h4 className="admin-form-section-title">Độ khó</h4>
                    <span className="admin-form-section-hint">
                      Tỉ lệ drop nhập dạng thập phân từ 0 đến 1
                    </span>
                  </div>
                  <div className="admin-tabs">
                    {DIFFICULTIES.map((item) => {
                      const hasError = errors.some((error) =>
                        error.path.startsWith(
                          `${selectedIndexSafe}.difficulties.${selected?.difficulties.findIndex((difficultyItem) => difficultyItem.key === item.key)}.`,
                        ),
                      );
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className="admin-tab"
                          aria-current={selectedDifficulty === item.key}
                          onClick={() => setSelectedDifficulty(item.key)}
                          disabled={saving}
                        >
                          {item.label}
                          {hasError && <span className="admin-err-dot" />}
                        </button>
                      );
                    })}
                  </div>
                  {difficulty && (
                    <div className="admin-form-grid">
                      <label className="admin-field">
                        <span className="admin-field-label">Hệ số quái</span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          className={`admin-input admin-num${difficultyError("enemyMultiplier") ? " invalid" : ""}`}
                          value={
                            Number.isNaN(difficulty.enemyMultiplier)
                              ? ""
                              : difficulty.enemyMultiplier
                          }
                          onChange={(event) =>
                            setDifficultyField(
                              selectedIndexSafe,
                              selectedDifficulty,
                              "enemyMultiplier",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          aria-label={`Hệ số quái — ${difficultyLabel(selectedDifficulty)}`}
                        />
                        {difficultyError("enemyMultiplier") && (
                          <span className="admin-field-error">
                            {difficultyError("enemyMultiplier")?.message}
                          </span>
                        )}
                      </label>
                      <label className="admin-field">
                        <span className="admin-field-label">
                          Drop quái thường
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step="0.01"
                          className={`admin-input admin-num${difficultyError("normalDropRate") ? " invalid" : ""}`}
                          value={
                            Number.isNaN(difficulty.normalDropRate)
                              ? ""
                              : difficulty.normalDropRate
                          }
                          onChange={(event) =>
                            setDifficultyField(
                              selectedIndexSafe,
                              selectedDifficulty,
                              "normalDropRate",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          aria-label={`Tỉ lệ drop quái thường — ${difficultyLabel(selectedDifficulty)}`}
                        />
                        {difficultyError("normalDropRate") && (
                          <span className="admin-field-error">
                            {difficultyError("normalDropRate")?.message}
                          </span>
                        )}
                      </label>
                      <label className="admin-field">
                        <span className="admin-field-label">Drop boss</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step="0.01"
                          className={`admin-input admin-num${difficultyError("bossDropRate") ? " invalid" : ""}`}
                          value={
                            Number.isNaN(difficulty.bossDropRate)
                              ? ""
                              : difficulty.bossDropRate
                          }
                          onChange={(event) =>
                            setDifficultyField(
                              selectedIndexSafe,
                              selectedDifficulty,
                              "bossDropRate",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          aria-label={`Tỉ lệ drop boss — ${difficultyLabel(selectedDifficulty)}`}
                        />
                        {difficultyError("bossDropRate") && (
                          <span className="admin-field-error">
                            {difficultyError("bossDropRate")?.message}
                          </span>
                        )}
                      </label>
                      <label className="admin-field">
                        <span className="admin-field-label">
                          Hệ số phần thưởng
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.05"
                          className={`admin-input admin-num${difficultyError("rewardMultiplier") ? " invalid" : ""}`}
                          value={
                            Number.isNaN(difficulty.rewardMultiplier)
                              ? ""
                              : difficulty.rewardMultiplier
                          }
                          onChange={(event) =>
                            setDifficultyField(
                              selectedIndexSafe,
                              selectedDifficulty,
                              "rewardMultiplier",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          aria-label={`Hệ số phần thưởng — ${difficultyLabel(selectedDifficulty)}`}
                        />
                        {difficultyError("rewardMultiplier") && (
                          <span className="admin-field-error">
                            {difficultyError("rewardMultiplier")?.message}
                          </span>
                        )}
                      </label>
                      <label className="admin-field">
                        <span className="admin-field-label">
                          Hệ số thích nghi
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.05"
                          className={`admin-input admin-num${difficultyError("adaptiveCoefficient") ? " invalid" : ""}`}
                          value={
                            Number.isNaN(difficulty.adaptiveCoefficient)
                              ? ""
                              : difficulty.adaptiveCoefficient
                          }
                          onChange={(event) =>
                            setDifficultyField(
                              selectedIndexSafe,
                              selectedDifficulty,
                              "adaptiveCoefficient",
                              event.target.value,
                            )
                          }
                          disabled={saving}
                          aria-label={`Hệ số thích nghi — ${difficultyLabel(selectedDifficulty)}`}
                        />
                        {difficultyError("adaptiveCoefficient") && (
                          <span className="admin-field-error">
                            {difficultyError("adaptiveCoefficient")?.message}
                          </span>
                        )}
                      </label>
                    </div>
                  )}
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
                    Lưu ghi đè toàn bộ cấu hình branch và difficulty.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-detail-empty">
              <p>Thêm bí cảnh đầu tiên sau khi có catalog nguyên liệu.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
