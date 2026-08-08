"use client";

import { useEffect, useMemo, useState } from "react";
import { canQueueAlchemy, secondsRemaining } from "@/lib/expedition-display";
import { formatNum } from "@/lib/format";
import type {
  AlchemyProfileDTO,
  AlchemyQueueDTO,
  AlchemyRecipeDTO,
  MaterialInventoryDTO,
} from "@/lib/types";

interface AlchemyDrawerProps {
  open: boolean;
  recipes: AlchemyRecipeDTO[];
  queue: AlchemyQueueDTO | null;
  profile: AlchemyProfileDTO | null;
  inventory: MaterialInventoryDTO[];
  linhThach: number;
  loading: boolean;
  error: string | null;
  busy: boolean;
  now: Date;
  onRetry: () => void;
  onClose: () => void;
  onEnqueue: (recipeId: string, quantity: number) => void;
  onRankUp: () => void;
  onUpgradeFurnace: () => void;
}

export function AlchemyDrawer({
  open,
  recipes,
  queue,
  profile,
  inventory,
  linhThach,
  loading,
  error,
  busy,
  now,
  onRetry,
  onClose,
  onEnqueue,
  onRankUp,
  onUpgradeFurnace,
}: AlchemyDrawerProps) {
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open) return;
    setRecipeId((previous) => previous ?? recipes[0]?.id ?? null);
    setQuantity(1);
  }, [open, recipes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === recipeId) ?? recipes[0],
    [recipes, recipeId],
  );
  const canEnqueue = Boolean(
    selectedRecipe &&
      !busy &&
      canQueueAlchemy(selectedRecipe, inventory, quantity, linhThach),
  );

  if (!open) return null;

  return (
    <div className="alchemy-overlay">
      <button
        type="button"
        className="alchemy-backdrop"
        aria-label="Đóng lò luyện đan"
        onClick={onClose}
      />
      <section
        className="alchemy-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alchemy-drawer-title"
      >
        <header className="alchemy-drawer-header">
          <div>
            <p className="alchemy-kicker">LÒ LUYỆN OFFLINE</p>
            <h2 id="alchemy-drawer-title">Luyện Đan</h2>
          </div>
          <button type="button" className="alchemy-close" onClick={onClose}>
            Đóng
          </button>
        </header>

        {error ? (
          <div className="alchemy-drawer-error">
            <p>{error}</p>
            <button type="button" className="alchemy-btn" onClick={onRetry}>
              Thử lại
            </button>
          </div>
        ) : loading && recipes.length === 0 ? (
          <p className="alchemy-empty">Đang tải công thức luyện đan...</p>
        ) : (
          <>
            <div className="alchemy-balance-strip">
              <span>
                Linh Thạch <strong>{formatNum(linhThach)}</strong>
              </span>
              <span>
                Nguyên liệu{" "}
                <strong>
                  {inventory.reduce((sum, item) => sum + item.quantity, 0)}
                </strong>
              </span>
            </div>

            {profile && (
              <div className="alchemy-profile-strip">
                <div className="alchemy-rank-row">
                  <span className="stat-label">Đan Sư</span>
                  <strong>Cấp {profile.profile.rank}</strong>
                  <small>
                    +{profile.successBonusPct}% thành công · −
                    {profile.speedBonusPct}% thời gian
                  </small>
                  {profile.nextRank ? (
                    <>
                      <button
                        type="button"
                        className="alchemy-btn"
                        disabled={
                          !profile.nextRank.affordable ||
                          !profile.nextRank.realmMet ||
                          !profile.nextRank.affordableDanHoaTuy ||
                          busy
                        }
                        onClick={onRankUp}
                        title={
                          !profile.nextRank.realmMet
                            ? `Cần cảnh giới cao hơn (realmMajor ${profile.nextRank.realmGateMajor})`
                            : !profile.nextRank.affordableDanHoaTuy
                              ? "Cần Đan Hỏa Tủy — rơi từ boss bí cảnh tầng 2+"
                              : `Tốn ${profile.nextRank.danKhiCost} Đan Khí${profile.nextRank.danHoaTuyCost > 0 ? ` + ${profile.nextRank.danHoaTuyCost} Đan Hỏa Tủy` : ""}`
                        }
                      >
                        Thăng cấp {profile.nextRank.target} ·{" "}
                        {profile.nextRank.danKhiCost} ĐK
                        {profile.nextRank.danHoaTuyCost > 0 &&
                          ` + Tủy ×${profile.nextRank.danHoaTuyCost}`}
                      </button>
                      {!profile.nextRank.realmMet && (
                        <small className="alchemy-recipe-lock">
                          Cần đạt cảnh giới cao hơn (realmMajor{" "}
                          {profile.nextRank.realmGateMajor}) để lên cấp{" "}
                          {profile.nextRank.target}
                        </small>
                      )}
                      {profile.nextRank.realmMet &&
                        !profile.nextRank.affordableDanHoaTuy && (
                          <small className="alchemy-recipe-lock">
                            Thiếu Đan Hỏa Tủy — rơi từ boss bí cảnh tầng 2+ (có{" "}
                            {profile.nextRank.danHoaTuyOwned})
                          </small>
                        )}
                    </>
                  ) : (
                    <small className="alchemy-cap-note">
                      Đan Sư cấp tối đa 9
                    </small>
                  )}
                </div>
                <div className="alchemy-rank-row">
                  <span className="stat-label">Đan Lô</span>
                  <strong>Cấp {profile.profile.furnaceLevel}</strong>
                  <small>
                    Đan Khí <strong>{formatNum(profile.profile.danKhi)}</strong>
                  </small>
                  {profile.nextFurnace && (
                    <button
                      type="button"
                      className="alchemy-btn"
                      disabled={
                        !profile.nextFurnace.affordableDanKhi ||
                        !profile.nextFurnace.affordableLinhThach ||
                        busy
                      }
                      onClick={onUpgradeFurnace}
                      title={`Tốn ${profile.nextFurnace.danKhiCost} Đan Khí + ${profile.nextFurnace.linhThachCost} Linh Thạch`}
                    >
                      Nâng lò {profile.nextFurnace.target} ·{" "}
                      {profile.nextFurnace.danKhiCost} ĐK +{" "}
                      {profile.nextFurnace.linhThachCost} LT
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="alchemy-drawer-section">
              <div className="alchemy-section-heading">
                <span>01</span>
                <h3>Chọn công thức</h3>
              </div>
              <div className="alchemy-recipe-grid">
                {recipes.map((recipe) => (
                  <button
                    type="button"
                    key={recipe.id}
                    className={`alchemy-recipe-item${selectedRecipe?.id === recipe.id ? " selected" : ""}${recipe.locked ? " alchemy-locked" : ""}`}
                    onClick={() => setRecipeId(recipe.id)}
                  >
                    <span className="alchemy-recipe-glyph">丹</span>
                    <span className="alchemy-recipe-copy">
                      <strong>
                        {recipe.pillId}
                        {recipe.tier > 1 && (
                          <span className="alchemy-tier-badge">Linh Giai</span>
                        )}
                      </strong>
                      <small>
                        {formatAlchemyDuration(
                          recipe.effectiveDurationSec ?? recipe.durationSec,
                        )}
                        {typeof recipe.effectiveSuccessPct === "number" &&
                          ` · ${recipe.effectiveSuccessPct}%`}{" "}
                        · {recipe.linhThachCost} Linh Thạch
                      </small>
                      {recipe.locked && (
                        <small className="alchemy-recipe-lock">
                          Cần Đan Sư cấp {recipe.minAlchemyRank}
                        </small>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selectedRecipe && (
              <div className="alchemy-form-panel">
                <div className="alchemy-form-detail">
                  <div>
                    <span className="alchemy-detail-label">
                      Nguyên liệu mỗi mẻ
                    </span>
                    <div className="alchemy-ingredient-list">
                      {selectedRecipe.ingredients.map((ingredient) => (
                        <span
                          className="alchemy-ingredient"
                          key={ingredient.materialId}
                        >
                          {materialName(ingredient.materialId, inventory)} ×
                          {ingredient.quantity * quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <label className="alchemy-quantity-field">
                    <span>Số mẻ</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          Math.max(1, Number(event.target.value) || 1),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="alchemy-form-footer">
                  <span>
                    Tổng phí:{" "}
                    <strong>
                      {formatNum(selectedRecipe.linhThachCost * quantity)} Linh
                      Thạch
                    </strong>
                  </span>
                  <button
                    type="button"
                    className="alchemy-btn alchemy-btn-primary"
                    disabled={!canEnqueue}
                    onClick={() => onEnqueue(selectedRecipe.id, quantity)}
                  >
                    {busy ? "Đang xếp hàng..." : "Đưa vào lò"}
                  </button>
                </div>
                {selectedRecipe.locked && (
                  <p className="alchemy-insufficient">
                    Công thức khóa — yêu cầu Đan Sư cấp{" "}
                    {selectedRecipe.minAlchemyRank}.
                  </p>
                )}
                {!canEnqueue && !busy && !selectedRecipe.locked && (
                  <p className="alchemy-insufficient">
                    Thiếu Linh Thạch hoặc nguyên liệu cần thiết.
                  </p>
                )}
              </div>
            )}

            <div className="alchemy-drawer-section">
              <div className="alchemy-section-heading">
                <span>02</span>
                <h3>Hàng đợi</h3>
              </div>
              {queue?.jobs.length ? (
                <div className="alchemy-job-list">
                  {queue.jobs.map((job) => (
                    <div className="alchemy-job-row" key={job.id}>
                      <span
                        className={`alchemy-job-dot alchemy-job-${job.status}`}
                      />
                      <span className="alchemy-job-name">{job.recipeId}</span>
                      <span className="alchemy-job-quantity">
                        ×{job.quantity}
                      </span>
                      <span className="alchemy-job-time">
                        {job.status === "completed"
                          ? `Thành công ${job.successCount} · Xuất sắc ${job.critCount} · Hỏng ${job.failCount}`
                          : `${secondsRemaining(job.completesAt, now)}s`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="alchemy-empty alchemy-empty-inline">
                  Chưa có mẻ nào trong hàng đợi.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function materialName(
  materialId: string,
  inventory: MaterialInventoryDTO[],
): string {
  return (
    inventory.find((item) => item.materialId === materialId)?.material?.name ??
    materialId
  );
}

function formatAlchemyDuration(durationSec: number): string {
  if (durationSec === 1800) return "30 phút";
  if (durationSec === 7200) return "2 giờ";
  if (durationSec === 28800) return "8 giờ";
  return `${Math.ceil(durationSec / 60)} phút`;
}
