"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { CauldronIcon, ChartIcon, MountainIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth-context";

// Client-side guard only — a UX convenience. Real enforcement is the
// backend's requireAuth + requireAdmin on every /admin API: a non-admin who
// bypasses this redirect sees only failing requests.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (me?.role !== "admin") {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, me, router]);

  // Until the probe resolves (or while redirecting away), show a plain
  // placeholder — deliberately not the game's animated loading screen.
  if (isLoading || me?.role !== "admin") {
    return (
      <div className="admin-loading">
        <div className="admin-skeleton" aria-live="polite">
          Đang tải…
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1 className="admin-title">Quản trị</h1>
        <nav className="admin-nav">
          <Link
            href="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
          >
            <ChartIcon width={18} height={18} />
            Thống kê
          </Link>
          <Link
            href="/admin/realms"
            aria-current={pathname === "/admin/realms" ? "page" : undefined}
          >
            <MountainIcon width={18} height={18} />
            Cảnh giới
          </Link>
          <Link
            href="/admin/pills"
            aria-current={pathname === "/admin/pills" ? "page" : undefined}
          >
            <CauldronIcon width={18} height={18} />
            Đan dược
          </Link>
          <Link href="/">← Về game</Link>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
