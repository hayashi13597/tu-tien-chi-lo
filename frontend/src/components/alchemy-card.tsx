"use client";

import { DiamondMarker } from "@/components/icons";
import { secondsRemaining } from "@/lib/expedition-display";
import type {
  AlchemyJobDTO,
  AlchemyQueueDTO,
  MaterialInventoryDTO,
} from "@/lib/types";

interface AlchemyCardProps {
  queue: AlchemyQueueDTO | null;
  inventory: MaterialInventoryDTO[];
  loading: boolean;
  error: string | null;
  now: Date;
  onOpen: () => void;
  onRetry: () => void;
}

export function AlchemyCard({
  queue,
  inventory,
  loading,
  error,
  now,
  onOpen,
  onRetry,
}: AlchemyCardProps) {
  const activeJob =
    queue?.jobs.find((job) => job.status !== "completed") ?? null;
  const materialCount = inventory.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="panel alchemy-card" aria-label="Luyện đan">
      <div className="panel-title alchemy-card-title">
        <DiamondMarker className="panel-title-marker" />
        <span>Luyện Đan</span>
        <span className="alchemy-status">Lò luyện</span>
      </div>

      {error ? (
        <div className="alchemy-empty">
          <p>{error}</p>
          <button type="button" className="alchemy-btn" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      ) : loading && !queue ? (
        <p className="alchemy-empty">Đang kiểm tra lò luyện...</p>
      ) : (
        <>
          <div className="alchemy-card-stats">
            <div>
              <span className="stat-label">Đang luyện</span>
              <strong>
                {activeJob ? `${activeJob.quantity} mẻ` : "Không có"}
              </strong>
            </div>
            <div>
              <span className="stat-label">Nguyên liệu</span>
              <strong>{inventory.length > 0 ? materialCount : "—"}</strong>
            </div>
          </div>
          {activeJob ? (
            <div className="alchemy-current-summary">
              <span>{activeJob.recipeId}</span>
              <strong>Còn {formatAlchemyEta(activeJob, now)}</strong>
            </div>
          ) : (
            <p className="alchemy-hint">
              Dùng nguyên liệu trong kho để luyện đan dược theo hàng đợi
              offline.
            </p>
          )}
          <button
            type="button"
            className="alchemy-btn alchemy-btn-primary"
            onClick={onOpen}
          >
            Mở lò luyện
          </button>
        </>
      )}
    </section>
  );
}

function formatAlchemyEta(job: AlchemyJobDTO, now: Date): string {
  const seconds = secondsRemaining(job.completesAt, now);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes > 0)
    return `${minutes}p ${remainder.toString().padStart(2, "0")}s`;
  return `${remainder}s`;
}
