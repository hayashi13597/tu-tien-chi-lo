"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { redeemCode } from "@/lib/api";
import type { RedeemResult } from "@/lib/types";

interface RedeemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: RedeemResult) => void;
}

export function RedeemModal({ open, onClose, onSuccess }: RedeemModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Panel scale/fade-in on open — matches the pill modal's entrance.
  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    const panel = panelRef.current;
    if (!panel) return;
    gsap.fromTo(
      panel,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await redeemCode(code.trim());
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi code thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pill-overlay">
      <button
        type="button"
        className="pill-backdrop"
        aria-label="Đóng nhập code"
        onClick={onClose}
      />
      <div ref={panelRef} className="pill-panel" style={{ maxWidth: 420 }}>
        <div className="pill-panel-title">
          <span>Nhập Code</span>
          <button type="button" className="pill-close" onClick={onClose}>
            Đóng
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            padding: "0.5rem 0",
          }}
        >
          <input
            className="login-input"
            type="text"
            placeholder="Nhập mã đổi thưởng..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={loading}
            // biome-ignore lint/a11y/noAutofocus: modal focuses its only input on open
            autoFocus
            autoComplete="off"
            style={{ textTransform: "uppercase" }}
          />
          {error && <p style={{ color: "var(--red)", margin: 0 }}>{error}</p>}
          <button
            type="submit"
            className="pill-use-btn"
            style={{ width: "auto" }}
            disabled={loading || !code.trim()}
          >
            {loading ? "Đang đổi..." : "Đổi ngay"}
          </button>
        </form>
      </div>
    </div>
  );
}
