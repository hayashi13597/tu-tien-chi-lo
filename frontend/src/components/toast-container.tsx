"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import type { ToastItem } from "@/lib/types";

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Slide each toast in from the right on mount/update.
  useEffect(() => {
    if (!containerRef.current) return;
    const toastsEls = containerRef.current.querySelectorAll(".toast");
    toastsEls.forEach((el) => {
      gsap.fromTo(
        el,
        { x: 100, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
      );
    });
  }, []);

  return (
    <div ref={containerRef} className="toast-container">
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => onDismiss(t.id)}
        >
          <div className="toast-title">{t.title}</div>
          <div className="toast-msg">{t.message}</div>
        </button>
      ))}
    </div>
  );
}
