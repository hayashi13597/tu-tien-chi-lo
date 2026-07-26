"use client";

import { DiamondMarker } from "@/components/icons";
import {
  expeditionUiMode,
  formatExpeditionDuration,
  secondsRemaining,
} from "@/lib/expedition-display";
import { formatNum } from "@/lib/format";
import type { CurrentExpeditionDTO } from "@/lib/types";

interface ExpeditionCardProps {
  current: CurrentExpeditionDTO | null;
  loading: boolean;
  error: string | null;
  now: Date;
  onOpen: () => void;
  onRetry: () => void;
}

export function ExpeditionCard({
  current,
  loading,
  error,
  now,
  onOpen,
  onRetry,
}: ExpeditionCardProps) {
  const mode = current ? expeditionUiMode(current, now) : "available";
  const expedition = current?.expedition;
  const countdown = expedition
    ? secondsRemaining(expedition.completesAt, now)
    : 0;

  return (
    <section className="panel expedition-card" aria-label="Bí cảnh">
      <div className="panel-title expedition-card-title">
        <DiamondMarker className="panel-title-marker" />
        <span>Bí Cảnh</span>
        <span className={`expedition-status expedition-status-${mode}`}>
          {mode === "available"
            ? "Sẵn sàng"
            : mode === "running"
              ? "Đang hành quân"
              : "Đã hoàn tất"}
        </span>
      </div>

      {error ? (
        <div className="expedition-empty">
          <p>{error}</p>
          <button type="button" className="expedition-btn" onClick={onRetry}>
            Thử lại
          </button>
        </div>
      ) : loading && !current ? (
        <p className="expedition-empty">Đang dò tìm bí cảnh...</p>
      ) : (
        <>
          <div className="expedition-ticket-row">
            <span className="stat-label">Điểm vé hôm nay</span>
            <span className="expedition-ticket-value">
              {formatNum(current?.remainingUnits ?? 0)}
              <span className="expedition-ticket-max"> / 12</span>
            </span>
          </div>
          {expedition ? (
            <div className="expedition-current-summary">
              <span className="expedition-summary-label">
                {expedition.branchId}
              </span>
              <span className="expedition-summary-meta">
                {formatExpeditionDuration(expedition.durationSec)} ·{" "}
                {expedition.ticketCostUnits} điểm
              </span>
              {mode === "running" ? (
                <strong className="expedition-countdown">
                  Còn {formatCountdown(countdown)}
                </strong>
              ) : (
                <strong className="expedition-countdown expedition-countdown-ready">
                  Có thể nhận thưởng
                </strong>
              )}
            </div>
          ) : (
            <p className="expedition-hint">
              Chọn một nhánh để săn nguyên liệu luyện đan và nâng cấp công pháp.
            </p>
          )}
          <button
            type="button"
            className="expedition-btn expedition-btn-primary"
            onClick={onOpen}
          >
            {mode === "available" ? "Chọn bí cảnh" : "Xem chuyến đi"}
          </button>
        </>
      )}
    </section>
  );
}

function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}g ${minutes.toString().padStart(2, "0")}p`;
  return `${minutes.toString().padStart(2, "0")}p ${seconds
    .toString()
    .padStart(2, "0")}s`;
}
