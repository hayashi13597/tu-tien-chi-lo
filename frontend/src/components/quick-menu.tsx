"use client";

import { useEffect, useRef, useState } from "react";
import { MenuIcon } from "@/components/icons";

interface QuickMenuProps {
  onOpenStats: () => void;
}

export function QuickMenu({ onOpenStats }: QuickMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the menu when a click lands outside its container.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="quick-menu" ref={containerRef}>
      {open && (
        <div className="quick-menu-list">
          <button
            type="button"
            className="popup-trigger"
            onClick={() => {
              onOpenStats();
              setOpen(false);
            }}
          >
            Tu Hành Bảng
          </button>
        </div>
      )}
      <button
        type="button"
        className="quick-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Mở menu"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>
    </div>
  );
}
