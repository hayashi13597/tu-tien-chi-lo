"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { PillCard } from "@/components/pill-card";
import type { PillEffectKind, PillInventoryItem } from "@/lib/types";

interface PillModalProps {
  open: boolean;
  inventory: PillInventoryItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onUse: (pillId: string) => void;
  isDisabled: (kind: PillEffectKind) => { disabled: boolean; reason?: string };
}

export function PillModal({
  open,
  inventory,
  loading,
  error,
  onRetry,
  onClose,
  onUse,
  isDisabled,
}: PillModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Open animation: panel scales/fades in, cards stagger up. Runs each time the
  // modal transitions to open. GSAP + useEffect matches the existing overlays.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    gsap.fromTo(
      panel,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
    gsap.fromTo(
      panel.querySelectorAll(".pill-card"),
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.05,
        delay: 0.1,
        ease: "power2.out",
      },
    );
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pill-overlay">
      <button
        type="button"
        className="pill-backdrop"
        aria-label="Đóng đan phòng"
        onClick={onClose}
      />
      <div ref={panelRef} className="pill-panel">
        <div className="pill-panel-title">
          <span>Đan Phòng · 丹房</span>
          <button type="button" className="pill-close" onClick={onClose}>
            Đóng
          </button>
        </div>
        {error ? (
          <div className="pill-empty">
            <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</p>
            <button
              type="button"
              className="pill-use-btn"
              style={{ width: "auto" }}
              onClick={onRetry}
            >
              Thử Lại
            </button>
          </div>
        ) : loading && inventory.length === 0 ? (
          <p className="pill-empty">Đang tải kho đan...</p>
        ) : inventory.length === 0 ? (
          <p className="pill-empty">Đan phòng trống, cần luyện đan.</p>
        ) : (
          <div className="pill-grid">
            {inventory.map((item) => {
              const { disabled, reason } = isDisabled(item.effectKind);
              return (
                <PillCard
                  key={item.id}
                  item={item}
                  disabled={disabled}
                  disabledReason={reason}
                  onUse={onUse}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
