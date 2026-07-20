# Admin Pro-Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three admin pages (`/admin`, `/admin/realms`, `/admin/pills`) and their shared shell from the cosmic/glass game register into a calm, dense pro-dashboard/control-panel register — frontend-only, no logic changes.

**Architecture:** Presentational + layout reshape only. `admin/layout.tsx` becomes a sidebar-rail shell; each page reshapes its JSX into new containers (KPI strip + distribution panel; realms master/detail; pill card-grid + editor panel) while preserving every existing state machine, validation, and guard behavior. The one intentional exception is the realms selection model: the accordion's `openRealms: Set<number>` (multiple realms expandable at once) becomes a single `selectedRealm: number` (one realm shown in the detail pane) — the same index-remap-on-removal logic is kept. Nearly all real change is in the `.admin-*` block of `frontend/src/app/globals.css`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (design tokens in `globals.css`), Biome (lint), Vitest (existing pure-logic tests only). Package manager: `pnpm`. All commands run from `frontend/`.

## Global Constraints

- **Frontend-only.** No backend/API/DTO/validation/business-logic changes. Same endpoints and same request/response shapes.
- **No dependency changes.** No new packages, no new web-font imports. Reuse existing `globals.css` tokens (`--gold`/`--jade`/`--red`/`--purple`/`--surface*`/spacing/radius/motion) and existing icons (`ChartIcon`, `MountainIcon`, `CauldronIcon`, `ShieldIcon`, `AlertIcon` in `src/components/icons.tsx`).
- **Preserve all interaction logic exactly:** guards, draft/undo/save state machines, `validateRealmDraft`/`findError`, `validatePillDraft`/`findPillError`, `statsForKind`, `PILL_KIND_FIELDS`, `disabled={saving}` discipline, `beforeunload` warnings, unsaved-switch `window.confirm`, NaN-blocks-save numeric convention, realm index-remap on removal.
- **No new tests.** Existing frontend suite (48 tests) must stay green untouched. Visual parity is a human-observation gate.
- **Per-task gate:** `pnpm lint` && `pnpm tsc --noEmit` && `pnpm test` && `pnpm build` all green before commit.
- **Accessibility carried forward:** ≥44px touch targets on nav/actions, visible focus (global `:focus-visible`), every field keeps a visible label, contrast ≥4.5:1.
- **Copy:** Vietnamese UI strings; describe reused design/data as intentional reuse, not "copying". Commit messages omit any Co-Authored-By/Claude attribution trailer.
- **Spec:** `docs/superpowers/specs/2026-07-21-admin-pro-dashboard-rebuild-design.md`.

---

## File Structure

- `frontend/src/app/globals.css` — the `.admin-*` block (~lines 1386–1867, end of file) is rewritten across Tasks 1–4. Each task edits only the class families it owns to keep diffs reviewable.
- `frontend/src/app/admin/layout.tsx` — Task 1. Sidebar-rail shell + responsive top-tabs; guard/loading logic unchanged.
- `frontend/src/app/admin/page.tsx` — Task 2. KPI strip (4 tiles incl. derived "most-populated realm") + distribution panel; own topbar row.
- `frontend/src/app/admin/realms/page.tsx` — Task 3. Master/detail; `openRealms` Set → single `selectedRealm`; per-sub-stage labeled-grid cards.
- `frontend/src/app/admin/pills/page.tsx` — Task 4. Card grid + editor panel; `PillForm` reused.

Ordering rationale: Task 1 establishes the shell + shared classes (`.admin-topbar`, `.admin-panel`, `--font-mono`, `.admin-num`) that Tasks 2–4 consume. Each subsequent page is independently reviewable.

---

## Task 1: Sidebar shell + shared dashboard primitives

**Files:**
- Modify: `frontend/src/app/admin/layout.tsx`
- Modify: `frontend/src/app/globals.css` (rewrite `.admin-loading`/`.admin-skeleton`/`.admin-shell`/`.admin-header`/`.admin-title`/`.admin-nav*`/`.admin-main` families; add `--font-mono`, `.admin-rail*`, `.admin-topbar`, `.admin-panel`, `.admin-num`)

**Interfaces:**
- Consumes: existing tokens in `:root`; icons `ChartIcon`, `MountainIcon`, `CauldronIcon` from `@/components/icons`; `useAuth()` from `@/lib/auth-context`.
- Produces (CSS classes consumed by later tasks): `.admin-shell` (rail+main grid), `.admin-rail`, `.admin-rail-brand`, `.admin-rail-nav`, `.admin-rail-nav a` (active via `aria-current="page"`), `.admin-rail-back`, `.admin-main`, `.admin-topbar` (title left / action-slot right), `.admin-panel` (flat elevated surface), `.admin-num` (monospace numeric utility), CSS var `--font-mono`.

- [ ] **Step 1: Add the monospace token.** In `frontend/src/app/globals.css`, inside the `:root {…}` block (after `--dur: 250ms;`, before the closing `}` at ~line 54), add:

```css
  /* Monospace stack for numeric/data cells — system fonts, no web import. */
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono",
    "JetBrains Mono", Menlo, Consolas, monospace;
```

- [ ] **Step 2: Rewrite the shell CSS.** In `frontend/src/app/globals.css`, replace the block from `.admin-loading {` (~line 1386) through the end of `.admin-main {…}` (~line 1499) with the new shell system. Keep `.admin-loading` + `.admin-skeleton` + `@keyframes admin-pulse` behavior (retune surface to flat). Replace `.admin-shell`/`.admin-header`/`.admin-title`/`.admin-nav*`/`.admin-main` with:

```css
.admin-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--gold);
  font-size: 1.1rem;
}

.admin-skeleton {
  padding: var(--space-5) var(--space-8);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  animation: admin-pulse 1.4s ease-in-out infinite;
}

@keyframes admin-pulse {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 1;
  }
}

/* Sidebar shell: fixed rail + fluid main. Flat cosmic backdrop retained but
   dimmer than the game so it never competes with dense data. */
.admin-shell {
  position: relative;
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
  color: var(--fg);
}

.admin-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(
      /* Low-alpha (0.08) purple accent — deliberately dimmer than any --purple*
         token so it never competes with dense data; no token exists at this alpha. */
      ellipse at 15% 10%,
      rgba(168, 85, 247, 0.08) 0%,
      transparent 55%
    ), linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 60%, var(--bg) 100%);
}

.admin-rail {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-3);
  border-right: 1px solid var(--border);
  background: var(--surface-2);
  backdrop-filter: blur(12px);
}

.admin-rail-brand {
  font-family: var(--font-zcool), "ZCOOL XiaoWei", serif;
  font-size: 1.2rem;
  color: var(--gold);
  padding: 0 var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-2);
}

.admin-rail-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-rail-nav a,
.admin-rail-back {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: 0 var(--space-3);
  color: var(--fg-dim);
  text-decoration: none;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.admin-rail-nav a:hover,
.admin-rail-back:hover {
  color: var(--gold);
  background: rgba(251, 191, 36, 0.06);
}

.admin-rail-nav a[aria-current="page"] {
  color: var(--gold);
  background: rgba(251, 191, 36, 0.1);
  border-left-color: var(--gold);
}

.admin-rail-back {
  margin-top: auto;
  border-top: 1px solid var(--border);
  border-radius: 0;
  padding-top: var(--space-3);
}

.admin-main {
  position: relative;
  min-width: 0;
  padding: var(--space-5) var(--space-6);
  animation: admin-card-in var(--dur) var(--ease-out) both;
}

/* Per-page header row: title left, primary action slot right. */
.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.admin-topbar h2 {
  font-size: 1.3rem;
  color: var(--fg);
}

/* Flat elevated data panel — replaces glass/blur cards for data areas. */
.admin-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: var(--space-5);
}

.admin-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

/* Mobile: rail collapses to a horizontal top strip of icon+label tabs. */
@media (max-width: 768px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
  .admin-rail {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-right: none;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
  }
  .admin-rail-brand {
    display: none;
  }
  .admin-rail-nav {
    flex-direction: row;
    gap: var(--space-2);
  }
  .admin-rail-nav a {
    border-left: none;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
  }
  .admin-rail-nav a[aria-current="page"] {
    border-left-color: transparent;
    border-bottom-color: var(--gold);
  }
  .admin-rail-back {
    margin-top: 0;
    margin-left: auto;
    border-top: none;
    padding-top: 0;
    white-space: nowrap;
  }
  .admin-main {
    padding: var(--space-4);
  }
}
```

Note: `@keyframes admin-card-in` is defined later in the file (~line 1532) and is reused here by `.admin-main`; leave that keyframe in place when Task 2 rewrites the cards block.

- [ ] **Step 3: Rewrite the layout JSX.** Replace `frontend/src/app/admin/layout.tsx` body (the `return (<div className="admin-shell">…)` block, lines ~40–71) with the rail shell. Full file:

```tsx
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
      <aside className="admin-rail">
        <div className="admin-rail-brand">Quản trị</div>
        <nav className="admin-rail-nav">
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
        </nav>
        <Link className="admin-rail-back" href="/">
          ← Về game
        </Link>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run the gate.**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: lint clean, tsc no errors, 48 tests pass, build succeeds with `/admin`, `/admin/realms`, `/admin/pills` in the route output.

- [ ] **Step 5: Visual check.** `pnpm dev`, open `/admin` at 1440px and 375px. Rail shows brand + 3 nav items + back link; active item has gold left-accent (desktop) / bottom-accent (mobile); mobile collapses rail to a horizontal strip. (Requires backend up + an admin session; if unavailable, note it and rely on the build gate.)

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/app/admin/layout.tsx frontend/src/app/globals.css
git commit -m "feat(admin): sidebar-rail shell + flat dashboard primitives"
```

---

## Task 2: Stats page — KPI strip + distribution panel

**Files:**
- Modify: `frontend/src/app/admin/page.tsx`
- Modify: `frontend/src/app/globals.css` (rewrite `.admin-cards`/`.admin-card*` families → `.admin-kpi*`; retune `.admin-table`/`.admin-bar*`; keep `@keyframes admin-card-in`)

**Interfaces:**
- Consumes: `.admin-topbar`, `.admin-panel`, `.admin-num` (Task 1); `fetchAdminStats` from `@/lib/api`; `AdminStats` from `@/lib/types`; icons `ChartIcon`, `ShieldIcon`, `AlertIcon`, `MountainIcon`.
- Produces: `.admin-kpi` (grid), `.admin-kpi-tile` (+ `--jade`/`--gold`/`--red`/`--purple` modifiers), `.admin-dist-head`, `.admin-dist-table`, `.admin-bar`, `.admin-bar-pct`.

- [ ] **Step 1: Rewrite the stats CSS.** In `frontend/src/app/globals.css`, replace the `.admin-cards` through `.admin-bar-pct` families (~lines 1501–1630) with:

```css
.admin-kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.admin-kpi-tile {
  position: relative;
  border: 1px solid var(--border);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: var(--space-4) var(--space-5);
  animation: admin-card-in var(--dur) var(--ease-out) both;
}

.admin-kpi-tile:nth-child(1) {
  animation-delay: 0ms;
}
.admin-kpi-tile:nth-child(2) {
  animation-delay: 60ms;
}
.admin-kpi-tile:nth-child(3) {
  animation-delay: 120ms;
}
.admin-kpi-tile:nth-child(4) {
  animation-delay: 180ms;
}

.admin-kpi-tile--jade {
  border-left-color: var(--jade);
}
.admin-kpi-tile--red {
  border-left-color: var(--red);
}
.admin-kpi-tile--purple {
  border-left-color: var(--purple);
}

.admin-kpi-tile .value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 1.9rem;
  color: var(--fg);
  line-height: 1.1;
}

.admin-kpi-tile .label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--muted);
  font-size: 0.85rem;
  margin-top: var(--space-2);
}

.admin-kpi-tile .label svg {
  color: var(--gold);
}
.admin-kpi-tile--jade .label svg {
  color: var(--jade);
}
.admin-kpi-tile--red .label svg {
  color: var(--red);
}
.admin-kpi-tile--purple .label svg {
  color: var(--purple);
}

.admin-dist-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.admin-dist-head h3 {
  font-size: 1.05rem;
  color: var(--fg);
}

.admin-dist-head .total {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-size: 0.9rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-table th,
.admin-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.admin-table th {
  color: var(--muted);
  font-weight: 500;
  font-size: 0.8rem;
}

.admin-table td.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.admin-table tbody tr {
  transition: background var(--dur-fast) var(--ease-out);
}
.admin-table tbody tr:nth-child(even) {
  background: rgba(255, 255, 255, 0.02);
}
.admin-table tbody tr:hover {
  background: rgba(251, 191, 36, 0.06);
}

.admin-bar-cell {
  min-width: 120px;
}

.admin-bar {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--gold), var(--gold-deep));
  min-width: 2px;
}

.admin-bar-pct {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: right;
}
```

- [ ] **Step 2: Rewrite the stats JSX.** Replace `frontend/src/app/admin/page.tsx` with:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertIcon, ChartIcon, MountainIcon, ShieldIcon } from "@/components/icons";
import { fetchAdminStats } from "@/lib/api";
import type { AdminStats } from "@/lib/types";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tải được số liệu";
      // A refresh-proof 401 means the session is gone — back to login.
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bar widths are relative to the most-populated realm so the largest bar
  // always spans full width regardless of absolute player counts.
  const maxCount = stats
    ? Math.max(1, ...stats.realmDistribution.map((r) => r.count))
    : 1;

  // Most-populated realm, derived client-side (no extra API) for the 4th KPI.
  const topRealm = useMemo(() => {
    if (!stats || stats.realmDistribution.length === 0) return null;
    return stats.realmDistribution.reduce((a, b) => (b.count > a.count ? b : a));
  }, [stats]);

  return (
    <section>
      <div className="admin-topbar">
        <h2>Thống kê tổng quan</h2>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          <span>{error}</span>
          <button
            type="button"
            className="admin-btn"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="admin-kpi">
            <div className="admin-kpi-tile admin-kpi-tile--jade">
              <div className="value">{stats.totalUsers}</div>
              <div className="label">
                <ChartIcon width={16} height={16} />
                Tổng người chơi
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--gold">
              <div className="value">{stats.totalAdmins}</div>
              <div className="label">
                <ShieldIcon width={16} height={16} />
                Quản trị viên
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--red">
              <div className="value">{stats.punishedCount}</div>
              <div className="label">
                <AlertIcon width={16} height={16} />
                Đang chịu phạt
              </div>
            </div>
            <div className="admin-kpi-tile admin-kpi-tile--purple">
              <div className="value">{topRealm ? topRealm.realmName : "—"}</div>
              <div className="label">
                <MountainIcon width={16} height={16} />
                Cảnh giới đông nhất
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-dist-head">
              <h3>Phân bố cảnh giới</h3>
              <span className="total">{stats.totalUsers} người</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cảnh giới</th>
                  <th style={{ width: "45%" }}>Phân bố</th>
                  <th className="num">Số người</th>
                  <th className="num">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {stats.realmDistribution.map((r) => (
                  <tr key={r.realmMajor}>
                    <td>{r.realmName}</td>
                    <td className="admin-bar-cell">
                      <div
                        className="admin-bar"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </td>
                    <td className="num">{r.count}</td>
                    <td className="num">
                      {stats.totalUsers > 0
                        ? Math.round((r.count / stats.totalUsers) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
                {stats.realmDistribution.length === 0 && (
                  <tr>
                    <td colSpan={4}>Chưa có nhân vật nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Run the gate.**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: all green, 48 tests pass.

- [ ] **Step 4: Visual check.** `/admin`: 4 KPI tiles with monospace values + role-tinted left accents (the 4th shows the top realm name); distribution panel with thin bars, right-aligned monospace count + %, zebra + hover. Empty-distribution row renders when there are no characters.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/app/admin/page.tsx frontend/src/app/globals.css
git commit -m "feat(admin): KPI strip with derived top-realm tile + dense distribution panel"
```

---

## Task 3: Realms editor — master/detail

**Files:**
- Modify: `frontend/src/app/admin/realms/page.tsx`
- Modify: `frontend/src/app/globals.css` (replace `.admin-realm*` families with `.admin-realm-layout`/`.admin-realm-list*`/`.admin-substage-card`; keep `.admin-input`/`.admin-field-error`; retune)

**Interfaces:**
- Consumes: `.admin-topbar`, `.admin-panel`, `.admin-btn`, `.admin-btn-primary`, `.admin-input`, `.admin-field-error`, `.admin-error` (Tasks 1–2 + existing); `fetchAdminRealms`/`updateAdminRealms`; `validateRealmDraft`/`findError`; `RealmConfigDTO`/`SubStageConfigDTO`.
- Produces: `.admin-realm-layout` (master/detail grid), `.admin-realm-list`, `.admin-realm-list-item` (+ selected/error state), `.admin-realm-list-foot`, `.admin-substage-card`, `.admin-substage-grid`, `.admin-substage-field`.

- [ ] **Step 1: Replace the realm-editor CSS.** In `frontend/src/app/globals.css`, replace the `.admin-realm` through `.admin-realm-table-wrap` families (~lines 1688–1759) with:

```css
/* Realm editor — master (list) + detail (selected realm) */
.admin-realm-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--space-5);
  align-items: start;
}

.admin-realm-list {
  position: sticky;
  top: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.admin-realm-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--border);
  color: var(--fg-dim);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out);
}

.admin-realm-list-item:hover {
  background: rgba(251, 191, 36, 0.06);
  color: var(--fg);
}

.admin-realm-list-item[aria-current="true"] {
  background: rgba(251, 191, 36, 0.1);
  border-left-color: var(--gold);
  color: var(--gold);
}

.admin-realm-list-item .count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  color: var(--muted);
}

/* Red dot marking a realm that currently fails validation. */
.admin-realm-list-item .err-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
  flex: none;
}

.admin-realm-list-foot {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.admin-realm-detail {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  padding: var(--space-5);
}

.admin-substage-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  padding: var(--space-4);
  margin-top: var(--space-3);
}

.admin-substage-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.admin-substage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
}

.admin-substage-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--muted);
}

@media (max-width: 768px) {
  .admin-realm-layout {
    grid-template-columns: 1fr;
  }
  .admin-realm-list {
    position: static;
  }
}
```

- [ ] **Step 2: Rewrite the realms JSX.** Replace `frontend/src/app/admin/realms/page.tsx` with the master/detail version. It keeps every handler and the validation/save flow; `openRealms: Set<number>` becomes `selectedRealm: number`, and `removeRealm` remaps the single index the same way the old code remapped the set.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminRealms, updateAdminRealms } from "@/lib/api";
import { findError, validateRealmDraft } from "@/lib/realm-validation";
import type { RealmConfigDTO, SubStageConfigDTO } from "@/lib/types";

// Numeric tunable columns, in display order. name is handled separately.
const NUMERIC_FIELDS: { key: keyof SubStageConfigDTO; label: string }[] = [
  { key: "linhKhiRequired", label: "Linh khí cần" },
  { key: "cultivationRate", label: "Tốc độ tu" },
  { key: "baseSuccessRate", label: "Tỉ lệ gốc (%)" },
  { key: "pityIncrement", label: "Cộng dồn (%)" },
  { key: "maxSuccessRate", label: "Tỉ lệ tối đa (%)" },
  { key: "punishmentSeconds", label: "Phạt (giây)" },
];

function emptyStage(): SubStageConfigDTO {
  return {
    name: "Tân Kỳ",
    linhKhiRequired: 1,
    cultivationRate: 1,
    baseSuccessRate: 90,
    pityIncrement: 10,
    maxSuccessRate: 95,
    punishmentSeconds: 300,
  };
}

export default function AdminRealmsPage() {
  const [server, setServer] = useState<RealmConfigDTO[] | null>(null);
  const [draft, setDraft] = useState<RealmConfigDTO[] | null>(null);
  const [selectedRealm, setSelectedRealm] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // While a save is in flight, every draft-mutating control is disabled —
  // an edit made mid-save would be silently clobbered when the response
  // re-syncs the draft from the server's accepted copy.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const router = useRouter();

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(server),
    [draft, server],
  );
  const errors = useMemo(
    () => (draft ? validateRealmDraft(draft) : []),
    [draft],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { realms } = await fetchAdminRealms();
      setServer(realms);
      setDraft(structuredClone(realms));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Không tải được cấu hình";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setLoadError(message);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warn on tab close / reload while edits are unsaved. In-app nav via the
  // rail links is not intercepted (Next App Router has no route-guard API);
  // beforeunload covers the destructive cases.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // All draft edits go through one immutable updater so React re-renders and
  // the dirty/validation memos recompute.
  const updateDraft = useCallback(
    (fn: (draft: RealmConfigDTO[]) => RealmConfigDTO[]) => {
      setDraft((d) => (d ? fn(structuredClone(d)) : d));
    },
    [],
  );

  const setRealmName = (ri: number, name: string) =>
    updateDraft((d) => {
      d[ri].name = name;
      return d;
    });

  const setSubField = (
    ri: number,
    si: number,
    key: keyof SubStageConfigDTO,
    raw: string,
  ) =>
    updateDraft((d) => {
      const sub = d[ri].subStages[si];
      if (key === "name") {
        sub.name = raw;
      } else {
        // Empty input → NaN → caught by validation (Save disabled) instead of
        // silently coercing to 0.
        (sub[key] as number) = raw === "" ? Number.NaN : Number(raw);
      }
      return d;
    });

  const addRealm = () => {
    updateDraft((d) => {
      d.push({ name: "Cảnh giới mới", subStages: [emptyStage()] });
      return d;
    });
    // Focus the newly appended realm.
    setSelectedRealm((draft?.length ?? 0));
  };

  const removeRealm = (ri: number) => {
    updateDraft((d) => {
      d.splice(ri, 1);
      return d;
    });
    // Selection is a single index; realms after the removed one shift down by
    // one. Mirror the old open-set remap: drop if it was the removed realm,
    // decrement if it was above, clamp into range.
    setSelectedRealm((sel) => {
      const remaining = (draft?.length ?? 1) - 1;
      let next = sel;
      if (sel > ri) next = sel - 1;
      else if (sel === ri) next = Math.min(sel, remaining - 1);
      return Math.max(0, next);
    });
  };

  const addSubStage = (ri: number) =>
    updateDraft((d) => {
      const stages = d[ri].subStages;
      const last = stages[stages.length - 1];
      const next = emptyStage();
      if (last) {
        // Start from the previous stage's values so the monotonic rule holds
        // out of the box and the admin only tweaks deltas.
        Object.assign(next, last, {
          name: "Tân Kỳ",
          linhKhiRequired: Math.round(last.linhKhiRequired * 1.5),
        });
      }
      stages.push(next);
      return d;
    });

  const removeSubStage = (ri: number, si: number) =>
    updateDraft((d) => {
      d[ri].subStages.splice(si, 1);
      return d;
    });

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { realms } = await updateAdminRealms(draft);
      // Re-sync both copies from the server's accepted version.
      setServer(realms);
      setDraft(structuredClone(realms));
      setSavedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lưu thất bại";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      // Draft stays intact — the admin fixes and retries without losing edits.
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, router]);

  const undo = () => {
    if (server) setDraft(structuredClone(server));
    setSaveError(null);
  };

  if (loadError) {
    return (
      <div className="admin-error">
        <span>{loadError}</span>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!draft) return <p>Đang tải cấu hình…</p>;

  const globalError = findError(errors, -1, null, null);
  // Clamp selection defensively (draft can shrink out from under it).
  const ri = Math.min(selectedRealm, draft.length - 1);
  const realm = draft[ri];
  const realmNameError = realm ? findError(errors, ri, null, "name") : null;
  const noStagesError = realm ? findError(errors, ri, null, null) : null;

  // A realm has a validation error if any error targets its index.
  const realmHasError = (index: number) =>
    errors.some((e) => e.realmIndex === index);

  return (
    <section>
      <div className="admin-topbar">
        <h2>Cấu hình cảnh giới</h2>
        <div className="admin-toolbar" style={{ margin: 0 }}>
          <button
            type="button"
            className="admin-btn"
            onClick={undo}
            disabled={!dirty || saving}
          >
            Hoàn tác
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void save()}
            disabled={!dirty || errors.length > 0 || saving}
          >
            {saving ? "Đang lưu…" : "Lưu tất cả"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="admin-error">
          <span>{saveError}</span>
        </div>
      )}
      {globalError && (
        <div className="admin-error">
          <span>{globalError.message}</span>
        </div>
      )}
      {savedAt && !dirty && (
        <p style={{ color: "var(--muted)", marginBottom: "var(--space-3)" }}>
          Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}
        </p>
      )}

      <div className="admin-realm-layout">
        <div className="admin-realm-list">
          {draft.map((r, index) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: realms are an ordered, index-addressed draft — the index IS the identity the backend stores.
              key={index}
              type="button"
              className="admin-realm-list-item"
              aria-current={index === ri}
              onClick={() => setSelectedRealm(index)}
              disabled={saving}
            >
              <span>
                #{index} — {r.name || "(chưa có tên)"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {realmHasError(index) && <span className="err-dot" />}
                <span className="count">{r.subStages.length}</span>
              </span>
            </button>
          ))}
          <div className="admin-realm-list-foot">
            <button
              type="button"
              className="admin-btn"
              onClick={addRealm}
              disabled={saving}
            >
              + Thêm cảnh giới
            </button>
          </div>
        </div>

        {realm && (
          <div className="admin-realm-detail">
            <div className="admin-substage-card-head">
              <label style={{ flex: 1 }}>
                Tên cảnh giới #{ri}
                <input
                  className={`admin-input${realmNameError ? " invalid" : ""}`}
                  style={{ maxWidth: 320, marginTop: 4 }}
                  value={realm.name}
                  onChange={(e) => setRealmName(ri, e.target.value)}
                  disabled={saving}
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                onClick={() => removeRealm(ri)}
                disabled={saving}
              >
                Xóa cảnh giới
              </button>
            </div>
            {realmNameError && (
              <div className="admin-field-error">{realmNameError.message}</div>
            )}
            {noStagesError && (
              <div className="admin-field-error">{noStagesError.message}</div>
            )}

            {realm.subStages.map((sub, si) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: sub-stages are index-addressed draft rows.
              <div className="admin-substage-card" key={si}>
                <div className="admin-substage-card-head">
                  <label
                    className="admin-substage-field"
                    style={{ flex: 1, maxWidth: 260 }}
                  >
                    Tên tiểu cảnh giới
                    <input
                      className={`admin-input${findError(errors, ri, si, "name") ? " invalid" : ""}`}
                      aria-label={`Tên — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                      value={sub.name}
                      onChange={(e) =>
                        setSubField(ri, si, "name", e.target.value)
                      }
                      disabled={saving}
                    />
                    {findError(errors, ri, si, "name") && (
                      <span className="admin-field-error">
                        {findError(errors, ri, si, "name")?.message}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="admin-btn"
                    aria-label={`Xóa tiểu cảnh giới #${si} của cảnh giới #${ri}`}
                    onClick={() => removeSubStage(ri, si)}
                    disabled={saving}
                  >
                    Xóa
                  </button>
                </div>
                <div className="admin-substage-grid">
                  {NUMERIC_FIELDS.map((f) => {
                    const err = findError(errors, ri, si, f.key);
                    const value = sub[f.key] as number;
                    return (
                      <label className="admin-substage-field" key={f.key}>
                        {f.label}
                        <input
                          type="number"
                          className={`admin-input admin-num${err ? " invalid" : ""}`}
                          aria-label={`${f.label} — tiểu cảnh giới #${si}, cảnh giới #${ri}`}
                          value={Number.isNaN(value) ? "" : value}
                          onChange={(e) =>
                            setSubField(ri, si, f.key, e.target.value)
                          }
                          disabled={saving}
                        />
                        {err && (
                          <span className="admin-field-error">
                            {err.message}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="admin-toolbar" style={{ marginTop: "var(--space-4)" }}>
              <button
                type="button"
                className="admin-btn"
                onClick={() => addSubStage(ri)}
                disabled={saving}
              >
                + Thêm tiểu cảnh giới
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify the error-field shape.** Before relying on `e.realmIndex` in `realmHasError`, confirm the field name on the validation error type. Run: `grep -n "realmIndex\|realmIdx\|realm" frontend/src/lib/realm-validation.ts | head`. If the property is named differently (e.g. `realm`), update `realmHasError` and the `findError` call sites accordingly. (`findError(errors, ri, si, key)` is already the existing signature — keep it; only the dot-marker predicate reads the raw field.)

- [ ] **Step 4: Run the gate.**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: all green, 48 tests pass. (If lint flags the two `noArrayIndexKey` lines, the `biome-ignore` comments above suppress them — keep them.)

- [ ] **Step 5: Visual check.** `/admin/realms`: left list of all realms (index, name, sub-stage count, red dot when invalid); clicking selects; detail pane shows realm name + one card per sub-stage with every field labeled and no horizontal scroll; edit a field → Lưu enables; introduce an invalid value → red dot on that realm + Lưu disabled; Hoàn tác resets; add/remove realm keeps selection attached to the right realm; save shows the timestamp.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/app/admin/realms/page.tsx frontend/src/app/globals.css
git commit -m "feat(admin): master/detail realm editor with per-sub-stage labeled cards"
```

---

## Task 4: Pills catalog — card grid + editor panel

**Files:**
- Modify: `frontend/src/app/admin/pills/page.tsx`
- Modify: `frontend/src/app/globals.css` (replace `.admin-pill-list`/`.admin-pill-card`/`.admin-pill-head` families with `.admin-pill-layout`/`.admin-pill-grid`/`.admin-pill-editor`; keep `.admin-pill-glyph`/`.admin-pill-form*`/badge classes)

**Interfaces:**
- Consumes: `.admin-topbar`, `.admin-btn`, `.admin-btn-primary`, `.admin-input`, `.admin-error`, `.admin-field-error` (existing); `createAdminPill`/`fetchAdminPills`/`updateAdminPill`; `getRarityMeta`; `validatePillDraft`/`findPillError`/`PILL_KIND_FIELDS`; `AdminPillDTO`/`PillEffectKind`/`PillRarity`.
- Produces: `.admin-pill-layout` (grid + editor two-column on desktop), `.admin-pill-grid`, `.admin-pill-tile` (+ selected/inactive), `.admin-pill-editor`.

- [ ] **Step 1: Replace the pill-list CSS.** In `frontend/src/app/globals.css`, replace the `.admin-pill-list` through `.admin-pill-head` families (~lines 1762–1801) with the grid + editor layout. Keep `.admin-pill-glyph`, `.admin-pill-name`, `.admin-pill-rarity`, `.admin-pill-stat`, `.admin-pill-starter`, `.admin-pill-off`, `.admin-pill-form*` families as they are (they still fit).

```css
/* ---- Admin pill catalog: card grid + side editor ---- */
.admin-pill-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: start;
}

/* When an editor is open, split into grid | editor on desktop. */
.admin-pill-layout.editing {
  grid-template-columns: 1fr 360px;
}

.admin-pill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}

.admin-pill-tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-panel);
  color: var(--fg);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.admin-pill-tile:hover {
  border-color: var(--border-bright);
}

.admin-pill-tile[aria-current="true"] {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px var(--gold);
}

.admin-pill-tile.inactive {
  opacity: 0.55;
}

.admin-pill-tile-top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.admin-pill-tile-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
}

.admin-pill-editor {
  position: sticky;
  top: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-pop);
}

.admin-pill-editor-head {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  color: var(--gold);
}

.admin-pill-glyph {
  font-size: 1.6rem;
  line-height: 1;
  /* Rarity color is applied inline from getRarityMeta; add a soft glow in the
     same hue via currentColor so higher-rarity glyphs read as more radiant. */
  filter: drop-shadow(0 0 6px currentColor);
}

.admin-pill-name {
  font-weight: 600;
}

.admin-pill-rarity,
.admin-pill-stat {
  font-size: 0.85rem;
  color: var(--muted);
}

.admin-pill-stat {
  font-family: var(--font-mono);
}

.admin-pill-starter {
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--jade);
  color: var(--jade);
}

.admin-pill-off {
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--red);
  color: #f6b8b8;
}

@media (max-width: 768px) {
  .admin-pill-layout.editing {
    grid-template-columns: 1fr;
  }
  .admin-pill-editor {
    position: static;
  }
}
```

- [ ] **Step 2: Rewrite the pills JSX.** Replace `frontend/src/app/admin/pills/page.tsx` with the grid + editor-panel version. `PillForm` (the whole component, lines ~98–317 of the current file) is kept **verbatim** — copy it unchanged. Only `AdminPillsPage` changes: cards become a grid of `.admin-pill-tile` buttons, and the open form renders in a right-hand `.admin-pill-editor` panel instead of inline. Full file:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminPill, fetchAdminPills, updateAdminPill } from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import {
  findPillError,
  PILL_KIND_FIELDS,
  validatePillDraft,
} from "@/lib/pill-validation";
import type { AdminPillDTO, PillEffectKind, PillRarity } from "@/lib/types";

const EFFECT_KINDS: { value: PillEffectKind; label: string }[] = [
  { value: "linhKhi", label: "Tăng linh khí" },
  { value: "cultivationBuff", label: "Buff tốc độ tu" },
  { value: "breakthroughBoost", label: "Tăng tỉ lệ đột phá" },
  { value: "clearPunishment", label: "Giải trừng phạt" },
];

const RARITIES: PillRarity[] = [0, 1, 2, 3, 4];

// Editable defaults per effect kind. Switching kinds resets the stat fields:
// non-kind fields become null (the backend rejects orphaned values), the new
// kind's fields get a sensible starting point.
function statsForKind(
  kind: PillEffectKind,
): Pick<AdminPillDTO, "amount" | "multiplier" | "durationSec" | "bonusPct"> {
  switch (kind) {
    case "linhKhi":
      return {
        amount: 50,
        multiplier: null,
        durationSec: null,
        bonusPct: null,
      };
    case "cultivationBuff":
      return {
        amount: null,
        multiplier: 1.5,
        durationSec: 60,
        bonusPct: null,
      };
    case "breakthroughBoost":
      return {
        amount: null,
        multiplier: null,
        durationSec: null,
        bonusPct: 10,
      };
    case "clearPunishment":
      return {
        amount: null,
        multiplier: null,
        durationSec: null,
        bonusPct: null,
      };
  }
}

function emptyPill(): AdminPillDTO {
  return {
    id: "",
    name: "",
    glyph: "",
    rarity: 0,
    effectKind: "linhKhi",
    ...statsForKind("linhKhi"),
    desc: "",
    active: true,
    starterQuantity: 0,
  };
}

// One-line effect summary for the collapsed card.
function headlineStat(pill: AdminPillDTO): string {
  switch (pill.effectKind) {
    case "linhKhi":
      return `+${pill.amount ?? "?"} linh khí`;
    case "cultivationBuff":
      return `×${pill.multiplier ?? "?"} trong ${pill.durationSec ?? "?"}s`;
    case "breakthroughBoost":
      return `+${pill.bonusPct ?? "?"}% đột phá`;
    case "clearPunishment":
      return "Giải trừng phạt";
  }
}

const STAT_LABELS: Record<
  "amount" | "multiplier" | "durationSec" | "bonusPct",
  string
> = {
  amount: "Linh khí cộng",
  multiplier: "Hệ số tốc độ",
  durationSec: "Thời gian (giây)",
  bonusPct: "Cộng tỉ lệ (%)",
};

interface PillFormProps {
  initial: AdminPillDTO;
  isNew: boolean;
  onSaved: (saved: AdminPillDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function PillForm({
  initial,
  isNew,
  onSaved,
  onCancel,
  onDirtyChange,
}: PillFormProps) {
  const [draft, setDraft] = useState<AdminPillDTO>(() =>
    structuredClone(initial),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(
    () => validatePillDraft(draft, { isNew }),
    [draft, isNew],
  );
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  useEffect(() => {
    onDirtyChange(dirty);
    // Leaving the form (unmount) means the draft is gone — no longer dirty.
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof AdminPillDTO>(key: K, value: AdminPillDTO[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setKind = (kind: PillEffectKind) =>
    setDraft((d) => ({ ...d, effectKind: kind, ...statsForKind(kind) }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = isNew
        ? await createAdminPill(draft)
        : await updateAdminPill(
            draft.id,
            (({ id: _id, ...body }) => body)(draft),
          );
      onSaved(saved);
    } catch (e) {
      // Keep the draft; surface the server's message (e.g. PILL_ID_TAKEN).
      setSaveError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  // Numeric input helper: empty string becomes NaN, which validation flags —
  // never silently 0 (same convention as the realms editor).
  const numericValue = (v: number | null) =>
    v === null || Number.isNaN(v) ? "" : v;

  const idError = findPillError(errors, "id");
  const statFields = PILL_KIND_FIELDS[draft.effectKind];

  return (
    <div className="admin-pill-form">
      <div className="admin-pill-form-grid">
        <label>
          ID
          <input
            className={`admin-input${idError ? " invalid" : ""}`}
            value={draft.id}
            onChange={(e) => set("id", e.target.value)}
            readOnly={!isNew}
            aria-label="ID đan dược"
          />
          {idError && (
            <span className="admin-field-error">{idError.message}</span>
          )}
        </label>
        <label>
          Tên
          <input
            className={`admin-input${findPillError(errors, "name") ? " invalid" : ""}`}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            aria-label="Tên đan dược"
          />
        </label>
        <label>
          Glyph
          <input
            className={`admin-input${findPillError(errors, "glyph") ? " invalid" : ""}`}
            value={draft.glyph}
            onChange={(e) => set("glyph", e.target.value)}
            aria-label="Glyph đan dược"
          />
        </label>
        <label>
          Độ hiếm
          <select
            className="admin-input"
            value={draft.rarity}
            onChange={(e) =>
              set("rarity", Number(e.target.value) as PillRarity)
            }
            aria-label="Độ hiếm"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {getRarityMeta(r).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hiệu ứng
          <select
            className="admin-input"
            value={draft.effectKind}
            onChange={(e) => setKind(e.target.value as PillEffectKind)}
            aria-label="Loại hiệu ứng"
          >
            {EFFECT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {statFields.map((key) => {
          const err = findPillError(errors, key);
          return (
            <label key={key}>
              {STAT_LABELS[key]}
              <input
                type="number"
                className={`admin-input${err ? " invalid" : ""}`}
                value={numericValue(draft[key])}
                onChange={(e) =>
                  set(
                    key,
                    e.target.value === "" ? Number.NaN : Number(e.target.value),
                  )
                }
                aria-label={STAT_LABELS[key]}
              />
              {err && <span className="admin-field-error">{err.message}</span>}
            </label>
          );
        })}
        <label>
          Phát tân thủ
          <input
            type="number"
            className={`admin-input${findPillError(errors, "starterQuantity") ? " invalid" : ""}`}
            value={numericValue(draft.starterQuantity)}
            onChange={(e) =>
              set(
                "starterQuantity",
                e.target.value === "" ? Number.NaN : Number(e.target.value),
              )
            }
            aria-label="Số lượng phát cho người chơi mới"
          />
          {findPillError(errors, "starterQuantity") && (
            <span className="admin-field-error">
              {findPillError(errors, "starterQuantity")?.message}
            </span>
          )}
        </label>
        <label className="admin-pill-desc">
          Mô tả
          <textarea
            className={`admin-input${findPillError(errors, "desc") ? " invalid" : ""}`}
            value={draft.desc}
            onChange={(e) => set("desc", e.target.value)}
            rows={2}
            aria-label="Mô tả đan dược"
          />
        </label>
        <label className="admin-pill-active">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          Kích hoạt (tắt để ẩn khỏi người chơi — túi đồ được giữ nguyên)
        </label>
      </div>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={saving || errors.length > 0 || (!dirty && !isNew)}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={onCancel}
          disabled={saving}
        >
          {dirty ? "Hoàn tác" : "Đóng"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPillsPage() {
  const [pills, setPills] = useState<AdminPillDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "new" = the create form; a pill id = that pill's edit form; null = closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { pills: list } = await fetchAdminPills();
      setPills(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được danh sách");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Warn on tab close/refresh while an open form has unsaved edits. In-app
  // navigation is not intercepted (App Router has no route-guard API) —
  // consistent with the realms editor.
  useEffect(() => {
    if (!dirtyOpen) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyOpen]);

  // Changing which form is open unmounts the current one, discarding its
  // draft — confirm first when that draft has unsaved edits.
  const requestOpen = (next: string | null) => {
    if (
      dirtyOpen &&
      !window.confirm("Biểu mẫu đang mở có thay đổi chưa lưu. Bỏ thay đổi?")
    ) {
      return;
    }
    setOpenId(next);
  };

  const onSaved = (saved: AdminPillDTO) => {
    setPills((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      return prev.map((p) => (p.id === saved.id ? saved : p));
    });
    setOpenId(null);
  };

  if (loadError) {
    return (
      <div>
        <p className="admin-error">{loadError}</p>
        <button type="button" className="admin-btn" onClick={load}>
          Thử lại
        </button>
      </div>
    );
  }
  if (pills === null) {
    return <p>Đang tải…</p>;
  }

  const editingPill =
    openId && openId !== "new" ? pills.find((p) => p.id === openId) : null;
  const isEditing = openId !== null;

  return (
    <section>
      <div className="admin-topbar">
        <h2>Đan dược ({pills.length})</h2>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => requestOpen("new")}
          disabled={openId === "new"}
        >
          + Thêm đan dược
        </button>
      </div>

      <div className={`admin-pill-layout${isEditing ? " editing" : ""}`}>
        <div className="admin-pill-grid">
          {pills.map((pill) => {
            const meta = getRarityMeta(pill.rarity);
            return (
              <button
                key={pill.id}
                type="button"
                className={`admin-pill-tile${pill.active ? "" : " inactive"}`}
                aria-current={openId === pill.id}
                onClick={() => requestOpen(openId === pill.id ? null : pill.id)}
              >
                <div className="admin-pill-tile-top">
                  <span
                    className="admin-pill-glyph"
                    style={{ color: meta.color }}
                  >
                    {pill.glyph}
                  </span>
                  <span className="admin-pill-name">{pill.name}</span>
                </div>
                <span
                  className="admin-pill-rarity"
                  style={{ color: meta.color }}
                >
                  {meta.name}
                </span>
                <span className="admin-pill-stat">{headlineStat(pill)}</span>
                <div className="admin-pill-tile-badges">
                  {pill.starterQuantity > 0 && (
                    <span className="admin-pill-starter">
                      Tân thủ ×{pill.starterQuantity}
                    </span>
                  )}
                  {!pill.active && (
                    <span className="admin-pill-off">Đang tắt</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {isEditing && (
          <div className="admin-pill-editor">
            <div className="admin-pill-editor-head">
              {openId === "new" ? "Thêm đan dược" : `Sửa: ${editingPill?.name}`}
            </div>
            <PillForm
              key={openId}
              initial={openId === "new" ? emptyPill() : (editingPill as AdminPillDTO)}
              isNew={openId === "new"}
              onSaved={onSaved}
              onCancel={() => setOpenId(null)}
              onDirtyChange={setDirtyOpen}
            />
          </div>
        )}
      </div>
    </section>
  );
}
```

Note the `key={openId}` on `PillForm`: it forces a fresh form (and fresh draft) whenever the selected pill changes, matching the old behavior where each card mounted its own form instance.

- [ ] **Step 3: Run the gate.**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: all green, 48 tests pass.

- [ ] **Step 4: Visual check.** `/admin/pills`: responsive grid of pill tiles (glyph glows in rarity color, badges for starter/disabled, inactive dimmed); "+ Thêm đan dược" opens the create form in the right panel and the grid narrows; clicking a tile selects it (ring) and opens its edit form; switching selection while dirty prompts the confirm; save/disable/create all work; on mobile the editor stacks full-width below the grid.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/app/admin/pills/page.tsx frontend/src/app/globals.css
git commit -m "feat(admin): pill card grid with side editor panel"
```

---

## Task 5: Update CLAUDE.md + final gate

**Files:**
- Modify: `CLAUDE.md` (append a section documenting the rebuild)

- [ ] **Step 1: Append documentation.** Add a new section to `CLAUDE.md` after the "Admin Redesign (visual)" section:

```markdown
## Admin Pro-Dashboard Rebuild

Full frontend-only rebuild of the three admin pages + shell (`/admin`, `/admin/realms`, `/admin/pills`, `admin/layout.tsx`) from the cosmic/glass game register into a calm, dense **pro-dashboard/control-panel** register. Spec `docs/superpowers/specs/2026-07-21-admin-pro-dashboard-rebuild-design.md`, plan `docs/superpowers/plans/2026-07-21-admin-pro-dashboard-rebuild.md`. Built on `feat/admin-redesign`. **No API/DTO/logic/dependency changes** — reuses existing `globals.css` tokens; all guards, validation, draft/undo/save, and `beforeunload` behavior are untouched.

- **Shell:** `admin/layout.tsx` is now a sidebar-rail shell (`.admin-shell` grid: 220px rail + fluid main) instead of a sticky top-tab bar. Rail has a brand wordmark, vertical nav (icon + label, active = gold left-accent + filled bg), and "← Về game" pinned at the bottom. On ≤768px the rail collapses to a horizontal top strip. Each page owns its own `.admin-topbar` row (title left, primary action right).
- **Flat primitives:** new `--font-mono` token + `.admin-num` utility (tabular monospace for numeric cells). Data areas use flat `.admin-panel` (solid `--surface-elevated`, 1px border, no `blur`) instead of glass/gradient cards; accent tokens are now status hairlines/dots, not ambient glow. One 300ms content fade on mount (`admin-card-in`, reduced-motion-safe globally).
- **Stats (`/admin`):** 4-tile KPI strip (`.admin-kpi`) — players/admins/punished plus a **client-derived** "most-populated realm" tile (reduce over `realmDistribution`, no new API). Distribution is a `.admin-panel` with a titled header (+ total) and a dense table: name | thin bar (width vs. max) | right-aligned monospace count | right-aligned monospace %-of-total, with zebra + hover.
- **Realms (`/admin/realms`):** accordion replaced by **master/detail** (`.admin-realm-layout`). Left list shows every realm (index, name, sub-stage count, red error dot when invalid); `openRealms: Set<number>` became a single `selectedRealm` index (remove-and-remap logic preserved). Right pane shows the selected realm's name + one `.admin-substage-card` per sub-stage with all 7 fields in a labeled `.admin-substage-grid` — every field visibly labeled, no horizontal scroll. Save/undo/timestamp moved to the topbar.
- **Pills (`/admin/pills`):** one-per-row inline-expand replaced by a responsive **card grid** (`.admin-pill-grid` of `.admin-pill-tile`) + a dedicated **editor panel** (`.admin-pill-editor`, right column on desktop / stacked on mobile). `PillForm` is reused verbatim; `key={openId}` gives each selection a fresh form/draft. Selected tile gets a ring; inactive tiles dimmed; starter/disabled badges kept.
- **Verification:** per-task gate green — `pnpm lint` / `pnpm tsc --noEmit` / `pnpm test` (48, unchanged — presentational, no new tests) / `pnpm build` (all 3 admin routes present). Visual parity across 375/768/1024/1440px is the human-observation gate.
```

- [ ] **Step 2: Final full gate.**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: all green, 48 tests, all 3 admin routes in build output.

- [ ] **Step 3: Confirm no backend files changed.**

Run: `git -C /home/hayashi/working/tu-tien-chi-lo status --short backend/` (from repo root)
Expected: empty output (frontend-only rebuild).

- [ ] **Step 4: Commit.**

```bash
git add CLAUDE.md
git commit -m "docs: record admin pro-dashboard rebuild in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** Shell (§1)→Task 1; Stats (§2)→Task 2; Realms (§3)→Task 3; Pills (§4)→Task 4; CSS plan + testing/verification→folded into each task's CSS step + gate; docs→Task 5. All spec sections mapped.
- **Preserved-logic risk (realms remap):** Task 3 Step 2 reimplements the single-index remap and Step 3 verifies the validation-error field name before use.
- **No new deps / no backend:** enforced by Global Constraints + Task 5 Step 3 check.
- **Monospace:** `--font-mono` added in Task 1, consumed via `.admin-num` and `font-family: var(--font-mono)` in Tasks 2–4.
