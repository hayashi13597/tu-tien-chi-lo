"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CauldronIcon,
  CloseIcon,
  GiftIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
} from "@/components/icons";
import { useAuth } from "@/lib/auth-context";

interface HeaderMenuProps {
  onOpenPills: () => void;
  onOpenRedeem: () => void;
  onLogout: () => void;
}

// Header actions (Đan Phòng, Đăng xuất). On desktop they render inline; on
// mobile (sp) they collapse behind a hamburger toggle to keep the cramped
// header readable. Desktop vs mobile is a pure CSS-media decision (see
// globals.css) so this stays SSR-safe — no window measurement, no hydration
// mismatch. The dropdown is only interactive on mobile where it's visible.
export function HeaderMenu({
  onOpenPills,
  onOpenRedeem,
  onLogout,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const { me } = useAuth();
  const router = useRouter();
  const isAdmin = me?.role === "admin";

  const close = useCallback(() => setOpen(false), []);

  // Wrap each action so selecting an item also dismisses the dropdown.
  const handlePills = useCallback(() => {
    close();
    onOpenPills();
  }, [close, onOpenPills]);

  const handleRedeem = useCallback(() => {
    close();
    onOpenRedeem();
  }, [close, onOpenRedeem]);

  const handleAdmin = useCallback(() => {
    close();
    router.push("/admin");
  }, [close, router]);

  const handleLogout = useCallback(() => {
    close();
    onLogout();
  }, [close, onLogout]);

  // While open: Escape closes, and a click/tap outside the menu dismisses it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  return (
    <>
      {/* Desktop: inline actions. Hidden below the mobile breakpoint. */}
      <div className="header-actions-desktop">
        <button type="button" className="header-action" onClick={onOpenPills}>
          <CauldronIcon />
          <span>Đan Phòng</span>
        </button>
        <button type="button" className="header-action" onClick={onOpenRedeem}>
          <GiftIcon />
          <span>Nhập Code</span>
        </button>
        {isAdmin && (
          <button type="button" className="header-action" onClick={handleAdmin}>
            <ShieldIcon />
            <span>Quản trị</span>
          </button>
        )}
        <button type="button" className="header-action" onClick={onLogout}>
          <LogoutIcon />
          <span>Đăng xuất</span>
        </button>
      </div>

      {/* Mobile: hamburger toggle + dropdown. Hidden at/above desktop width. */}
      <div className="header-menu" ref={menuRef}>
        <button
          type="button"
          className="header-menu-toggle"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={dropdownId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        {open && (
          <div className="header-menu-dropdown" id={dropdownId} role="menu">
            <button
              type="button"
              role="menuitem"
              className="header-menu-item"
              onClick={handlePills}
            >
              <CauldronIcon />
              <span>Đan Phòng</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="header-menu-item"
              onClick={handleRedeem}
            >
              <GiftIcon />
              <span>Nhập Code</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                className="header-menu-item"
                onClick={handleAdmin}
              >
                <ShieldIcon />
                <span>Quản trị</span>
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="header-menu-item"
              onClick={handleLogout}
            >
              <LogoutIcon />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
