"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatSeconds } from "@/lib/format";
import type { BreakthroughResult } from "@/lib/types";

interface BreakthroughButtonProps {
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedRemaining: number | null;
  onAttempt: () => void;
  onSuccess: (result: BreakthroughResult) => void;
  onFailure: (result: BreakthroughResult) => void;
  onError: (message: string) => void;
}

export function BreakthroughButton({
  canBreakthrough,
  isMaxStage,
  punishedRemaining,
  onAttempt,
  onSuccess,
  onFailure,
  onError,
}: BreakthroughButtonProps) {
  const [attempting, setAttempting] = useState(false);

  const disabled =
    attempting || isMaxStage || punishedRemaining !== null || !canBreakthrough;

  let label = "Đột Phá Cảnh Giới";
  if (isMaxStage) label = "Đã Đạt Cực Cảnh";
  else if (punishedRemaining !== null)
    label = `Bị Phạt (${formatSeconds(punishedRemaining)})`;
  else if (!canBreakthrough) label = "Linh Khí Chưa Đủ";
  else if (attempting) label = "Đang Đột Phá...";

  const handleClick = async () => {
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
        className="btn btn-danger"
        onClick={handleClick}
        disabled={disabled}
      >
        <span>{label}</span>
      </button>
    </div>
  );
}
