"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

export function LoadingScreen() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hold the splash for 2s (matches the CSS loadProgress animation), then fade.
    const timer = setTimeout(() => {
      gsap.to(el, {
        opacity: 0,
        duration: 0.8,
        onComplete: () => {
          if (el) el.style.display = "none";
        },
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref} className="loading-screen">
      <div className="loading-text">Khai Khởi Linh Căn</div>
      <div className="loading-bar">
        <div className="loading-fill" />
      </div>
    </div>
  );
}
