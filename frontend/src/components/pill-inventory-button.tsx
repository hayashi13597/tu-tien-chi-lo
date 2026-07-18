"use client";

import { CauldronIcon } from "@/components/icons";

interface PillInventoryButtonProps {
  onClick: () => void;
}

export function PillInventoryButton({ onClick }: PillInventoryButtonProps) {
  return (
    <button type="button" className="header-action" onClick={onClick}>
      <CauldronIcon />
      <span>Đan Phòng</span>
    </button>
  );
}
