"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import type { BreakthroughResult } from "@/lib/types";

interface BreakthroughButtonProps {
  canBreakthrough: boolean;
  isMaxStage: boolean;
  /** True for the whole breakthrough flow (tribulation animation + resolution),
   * not just the POST. Keeps the button locked until phase returns to idle so
   * rapid clicks can't fire multiple backend attempts per animation. */
  busy: boolean;
  punishedRemaining: number | null;
  onAttempt: () => void;
  onSuccess: (result: BreakthroughResult) => void;
  onFailure: (result: BreakthroughResult) => void;
  onError: (message: string) => void;
  /** Pending breakthrough-boost bonus from a consumed pill; 0 when none. */
  bonusPct?: number;
}

export function BreakthroughButton({
  canBreakthrough,
  isMaxStage,
  busy,
  punishedRemaining,
  onAttempt,
  onSuccess,
  onFailure,
  onError,
  bonusPct = 0,
}: BreakthroughButtonProps) {
  const [attempting, setAttempting] = useState(false);

  const disabled =
    attempting ||
    busy ||
    isMaxStage ||
    punishedRemaining !== null ||
    !canBreakthrough;

  let label = "Đột Phá Cảnh Giới";
  if (isMaxStage) label = "Đã Đạt Cực Cảnh";
  else if (punishedRemaining !== null)
    label = `Trọng Thương (${formatSeconds(punishedRemaining)})`;
  else if (!canBreakthrough) label = "Linh Khí Chưa Đủ";
  else if (attempting || busy) label = "Đang Đột Phá...";

  const handleClick = async () => {
    // Guard against a click landing before the disabled state re-renders.
    if (disabled) return;
    onAttempt();
    setAttempting(true);
    try {
      const result = await apiFetch<BreakthroughResult>(
        "/cultivation/breakthrough",
        { method: "POST" },
      );
      if (result.success) {
        onSuccess(result);
      } else {
        onFailure(result);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Đột phá thất bại");
    } finally {
      setAttempting(false);
    }
  };

  return (
    <div className="actions">
      <button
        type="button"
        // `.punished` keeps the "Trọng Thương" label legible: the button is disabled
        // (dimmed to 0.4), which on the purple base made the text vanish — the
        // class restores full opacity with a red fill while still disabled.
        className={`btn btn-danger${punishedRemaining !== null ? " punished" : ""}`}
        onClick={handleClick}
        disabled={disabled}
      >
        <span>{label}</span>
        {bonusPct > 0 && !isMaxStage && (
          <span className="boost-badge">+{bonusPct}%</span>
        )}
      </button>
    </div>
  );
}
