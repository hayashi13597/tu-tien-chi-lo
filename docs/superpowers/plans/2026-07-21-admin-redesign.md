# Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin area (`/admin`, `/admin/realms`, `/admin/pills` + layout) visually match the game's cosmic/glass aesthetic, reusing existing design tokens, without changing any API, data flow, or logic.

**Architecture:** CSS-first. Nearly all changes live in the `.admin-*` block of `frontend/src/app/globals.css` (currently ~lines 1386–1662). Markup changes are minimal and additive: import/add SVG icons in the layout and stats nav, add accent modifier classes + a `%` figure on the stats page, and add one new admin icon to `components/icons.tsx`. No changes to `lib/`, `auth-context`, DTOs, validation, or the backend.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4 (CSS custom properties in `globals.css`), Biome (lint/format), Vitest.

## Global Constraints

- **Reuse existing tokens only.** Do NOT define new color tokens. Use: `--surface`, `--surface-2`, `--surface-elevated`, `--gold`, `--gold-deep`, `--gold-glow`, `--jade`, `--jade-glow`, `--purple`, `--purple-glow`, `--red`, `--fg`, `--fg-dim`, `--muted`, `--muted-dim`, `--border`, `--border-bright`, `--focus-ring`, `--space-1..8`, `--radius-sm/--radius/--radius-lg`, `--shadow-panel`, `--shadow-pop`, `--ease-out`, `--dur`, `--dur-fast`.
- **No API/logic changes.** Do not touch `lib/api.ts`, `lib/realm-validation.ts`, `lib/pill-validation.ts`, `lib/auth-context.tsx`, `lib/types.ts`, or backend. Keep all `fetch*`, validation, draft/undo/save, guard redirects, and `beforeunload` handlers exactly as they are.
- **No new dependencies.** No chart/animation libraries. Do not add GSAP calls; new motion is pure CSS.
- **Icons are SVG only** (stroke-based, Lucide-style, matching `components/icons.tsx` `base()` helper). No emoji as icons. Keep the existing `▾/▸` text chevrons OR swap to SVG per Task 3 — do not introduce emoji.
- **Reduced motion is already handled globally** by the `@media (prefers-reduced-motion: reduce)` block (globals.css ~1202) which neutralizes all `animation`/`transition` via `*`. New CSS animations need no extra guard, but do NOT remove or weaken that block.
- **Accessibility:** keep the global `:focus-visible` ring. Interactive targets ≥44px. Text contrast ≥4.5:1 on glass surfaces (`--muted`/`--fg-dim` are already tuned for this).
- **Copy is Vietnamese**, matching existing strings. Do not translate or reword existing labels.
- **Gate per task:** `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`. Test count must not drop (`pnpm test` — no new tests expected for presentational work). Final human-observation check at 375/768/1024/1440px.

**Verification note:** These tasks are presentational. There is no meaningful automated unit test for CSS appearance, so tasks do NOT follow red-green TDD. Each task's verification is: (1) the lint/tsc/build gate passes, (2) `pnpm test` count unchanged, and (3) a described visual check. Do not fabricate unit tests for styling.

---

### Task 1: Layout shell — cosmic backdrop, glass header, tabbed nav with icons, loading skeleton

**Files:**
- Modify: `frontend/src/components/icons.tsx` (add `ChartIcon`, `MountainIcon`; reuse `CauldronIcon`, `ShieldIcon` already present)
- Modify: `frontend/src/app/admin/layout.tsx` (add icons beside nav labels; wrap loading placeholder)
- Modify: `frontend/src/app/globals.css` (`.admin-loading`, `.admin-shell`, `.admin-header`, `.admin-title`, `.admin-nav`, `.admin-nav a`, `.admin-nav a[aria-current="page"]`, `.admin-main` — ~lines 1386–1437; add new `.admin-nav a svg`, `.admin-shell::before`, `.admin-skeleton` rules)

**Interfaces:**
- Produces: CSS classes `.admin-shell`, `.admin-header`, `.admin-nav`, `.admin-main`, `.admin-btn`, `.admin-btn-primary`, `.admin-toolbar`, `.admin-error` are reused by Tasks 2–4. New icons `ChartIcon`/`MountainIcon` exported from `icons.tsx`.

- [ ] **Step 1: Add two nav icons to `icons.tsx`**

Append these to `frontend/src/components/icons.tsx` (after `ShieldIcon`, before the final line), using the existing `base()` helper and `IconProps` type already in that file:

```tsx
// Bar-chart icon for the admin "Thống kê" (stats) tab.
export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Thống kê</title>
      <path d="M3 3v18h18" />
      <path d="M7 15v3" />
      <path d="M12 9v9" />
      <path d="M17 5v13" />
    </svg>
  );
}

// Mountain/peak icon for the admin "Cảnh giới" (realms) tab.
export function MountainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Cảnh giới</title>
      <path d="M3 20h18L14 6l-3 6-2-3z" />
    </svg>
  );
}
```

- [ ] **Step 2: Wire icons + glass loading into `layout.tsx`**

In `frontend/src/app/admin/layout.tsx`:

Update the import to pull the icons:

```tsx
import {
  CauldronIcon,
  ChartIcon,
  MountainIcon,
} from "@/components/icons";
```

Replace the loading return (line ~29-31) with a glass skeleton wrapper:

```tsx
  if (isLoading || me?.role !== "admin") {
    return (
      <div className="admin-loading">
        <div className="admin-skeleton" aria-live="polite">
          Đang tải…
        </div>
      </div>
    );
  }
```

Add an icon (size 18, `aria-hidden`) before each nav label's text. Each `<Link>` gets the icon as the first child, keeping the existing text. Example for the three main tabs (leave the `← Về game` link text-only):

```tsx
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
```

- [ ] **Step 3: Restyle the shell/header/nav/loading in `globals.css`**

Replace the existing `.admin-loading`, `.admin-shell`, `.admin-header`, `.admin-title`, `.admin-nav`, `.admin-nav a`, `.admin-nav a[aria-current="page"]`, `.admin-main` rules (~lines 1386–1437) with:

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
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  backdrop-filter: blur(20px);
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

.admin-shell {
  position: relative;
  min-height: 100vh;
  color: var(--fg);
}

/* Subtle cosmic backdrop — lower intensity than the game's .cosmic-bg so it
   never competes with the data. Fixed so it stays put while content scrolls. */
.admin-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(
      ellipse at 15% 10%,
      rgba(168, 85, 247, 0.1) 0%,
      transparent 55%
    ),
    radial-gradient(
      ellipse at 85% 90%,
      rgba(93, 217, 177, 0.07) 0%,
      transparent 55%
    ), linear-gradient(180deg, #08050f 0%, #120822 60%, #08050f 100%);
}

.admin-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-panel);
}

.admin-title {
  font-family: var(--font-zcool), "ZCOOL XiaoWei", serif;
  font-size: 1.4rem;
  color: var(--gold);
  text-shadow: 0 0 12px var(--gold-glow);
}

.admin-nav {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.admin-nav a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  color: var(--fg-dim);
  text-decoration: none;
  padding: var(--space-2) 2px;
  border-bottom: 2px solid transparent;
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);
}

.admin-nav a:hover {
  color: var(--gold);
}

.admin-nav a[aria-current="page"] {
  color: var(--gold);
  border-bottom-color: var(--gold);
  text-shadow: 0 0 10px var(--gold-glow);
}

.admin-main {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-6);
}
```

- [ ] **Step 4: Run the gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: all pass; `/admin`, `/admin/realms`, `/admin/pills` appear in the build route list.

Run: `pnpm test`
Expected: PASS, same test count as before the task (currently 48).

- [ ] **Step 5: Visual check**

With the backend up (`cd backend && docker compose up -d --build`) and `pnpm dev`, log in as an admin and open `/admin`. Confirm: cosmic gradient backdrop, glass sticky header with gold glowing title, three tabs each with an SVG icon, active tab underlined in gold. Hover a tab → smooth gold transition. Reload while loading → glass "Đang tải…" skeleton pulsing (not bare text). Check 375px: header wraps, tabs remain tappable (≥44px).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/icons.tsx frontend/src/app/admin/layout.tsx frontend/src/app/globals.css
git commit -m "feat(admin): glass cosmic shell, tabbed nav with icons, loading skeleton"
```

---

### Task 2: Stats page — glass stat cards with accent + icons, stagger reveal, styled distribution bars

**Files:**
- Modify: `frontend/src/app/admin/page.tsx` (add accent modifier class + icon per card; add `%` figure to distribution rows)
- Modify: `frontend/src/app/globals.css` (`.admin-cards`, `.admin-card`, `.admin-card .value`, `.admin-card .label`, `.admin-table`, `.admin-table th/td`, `.admin-bar` — ~lines 1439–1480; add `.admin-card` accent modifiers, `.admin-card-icon`, stagger keyframes, `.admin-bar-cell`, `.admin-bar-pct`, row hover)

**Interfaces:**
- Consumes: `.admin-shell`/`.admin-main`/`.admin-toolbar`/`.admin-btn`/`.admin-error` from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add icons + accent classes + % to `page.tsx`**

In `frontend/src/app/admin/page.tsx`, add to the imports:

```tsx
import { LogoutIcon } from "@/components/icons";
```

Wait — do NOT reuse `LogoutIcon`. Instead add three small inline SVGs via existing icons. Use `ChartIcon` for players, `ShieldIcon` for admins, and a warning-style icon for punished. Add a new `AlertIcon` to `icons.tsx` first:

```tsx
// Alert/warning triangle for the "đang chịu phạt" (punished) stat.
export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Cảnh báo</title>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.5" />
    </svg>
  );
}
```

Then in `page.tsx` imports:

```tsx
import { AlertIcon, ChartIcon, ShieldIcon } from "@/components/icons";
```

Replace the three-card block (the `<div className="admin-cards">…</div>`, lines ~71–84) with accent modifiers and icons:

```tsx
          <div className="admin-cards">
            <div className="admin-card admin-card--jade">
              <span className="admin-card-icon">
                <ChartIcon width={22} height={22} />
              </span>
              <div className="value">{stats.totalUsers}</div>
              <div className="label">Tổng người chơi</div>
            </div>
            <div className="admin-card admin-card--gold">
              <span className="admin-card-icon">
                <ShieldIcon width={22} height={22} />
              </span>
              <div className="value">{stats.totalAdmins}</div>
              <div className="label">Quản trị viên</div>
            </div>
            <div className="admin-card admin-card--red">
              <span className="admin-card-icon">
                <AlertIcon width={22} height={22} />
              </span>
              <div className="value">{stats.punishedCount}</div>
              <div className="label">Đang chịu phạt</div>
            </div>
          </div>
```

Replace the distribution bar cell (the `<td>` wrapping `.admin-bar`, lines ~100–105) so it shows the bar plus a `%` figure. The row currently is:

```tsx
                  <td>
                    <div
                      className="admin-bar"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </td>
```

Replace with:

```tsx
                  <td>
                    <div className="admin-bar-cell">
                      <div
                        className="admin-bar"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                      <span className="admin-bar-pct">
                        {stats.totalUsers > 0
                          ? Math.round((r.count / stats.totalUsers) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                  </td>
```

(Note: the bar *width* stays relative to `maxCount` as before — the largest realm bar spans full width. The `%` figure is share of `totalUsers`, which is the meaningful number for a reader. This uses only `stats` fields already in scope; no new data.)

- [ ] **Step 2: Restyle cards + table + bars in `globals.css`**

Replace `.admin-cards`, `.admin-card`, `.admin-card .value`, `.admin-card .label`, `.admin-table`, `.admin-table th/td`, `.admin-bar` (~lines 1439–1480) with:

```css
.admin-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.admin-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-5);
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-panel);
  /* Stagger reveal — the nth-child delays below fan the cards in. No overshoot
     (data UI): plain ease-out slide+fade. */
  animation: admin-card-in var(--dur) var(--ease-out) both;
}

.admin-cards .admin-card:nth-child(1) {
  animation-delay: 0ms;
}
.admin-cards .admin-card:nth-child(2) {
  animation-delay: 70ms;
}
.admin-cards .admin-card:nth-child(3) {
  animation-delay: 140ms;
}

@keyframes admin-card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Top accent hairline, tinted per card role. */
.admin-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gold);
}
.admin-card--jade::before {
  background: var(--jade);
}
.admin-card--red::before {
  background: var(--red);
}

.admin-card-icon {
  display: inline-flex;
  color: var(--gold);
  margin-bottom: var(--space-2);
}
.admin-card--jade .admin-card-icon {
  color: var(--jade);
}
.admin-card--red .admin-card-icon {
  color: var(--red);
}

.admin-card .value {
  font-size: 2rem;
  color: var(--gold);
  text-shadow: 0 0 12px var(--gold-glow);
}
.admin-card--jade .value {
  color: var(--jade);
  text-shadow: 0 0 12px var(--jade-glow);
}
.admin-card--red .value {
  color: #f6b8b8;
  text-shadow: none;
}

.admin-card .label {
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

.admin-table tbody tr {
  transition: background var(--dur-fast) var(--ease-out);
}
.admin-table tbody tr:hover {
  background: rgba(251, 191, 36, 0.06);
}

.admin-bar-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.admin-bar {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, var(--gold), var(--gold-deep));
  box-shadow: 0 0 8px var(--gold-glow);
  min-width: 2px;
}

.admin-bar-pct {
  flex: none;
  font-size: 0.8rem;
  color: var(--muted);
  min-width: 3ch;
  text-align: right;
}
```

- [ ] **Step 3: Run the gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: all pass.

Run: `pnpm test`
Expected: PASS, count unchanged (48).

- [ ] **Step 4: Visual check**

On `/admin`: three glass stat cards, each with a colored top hairline + icon (jade players, gold admins, red punished), big glowing numbers, fanning in on load. Distribution table rows highlight on hover; each bar has a glow and a `%` figure to its right. Confirm the `%` reads share-of-total (sums roughly to 100 across realms). Empty state ("Chưa có nhân vật nào.") still shows when there are no characters.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/icons.tsx frontend/src/app/admin/page.tsx frontend/src/app/globals.css
git commit -m "feat(admin): glass stat cards with accents, stagger reveal, distribution bars"
```

---

### Task 3: Realms editor — glass accordion, animated chevron, glass inputs, button polish

**Files:**
- Modify: `frontend/src/app/globals.css` (`.admin-btn`, `.admin-btn-primary`, `.admin-toolbar`, `.admin-realm`, `.admin-realm-head`, `.admin-realm-body`, `.admin-input`, `.admin-input.invalid`, `.admin-field-error`, `.admin-error` — ~lines 1482–1571; add hover/transition + glass treatment)
- (No markup change required — the existing `▾/▸` chevron in `admin/realms/page.tsx` is kept.)

**Interfaces:**
- Consumes: shell/nav from Task 1.
- Produces: `.admin-btn`, `.admin-btn-primary`, `.admin-input`, `.admin-input.invalid` styling reused by Task 4 (pills form).

- [ ] **Step 1: Restyle buttons, toolbar, accordion, inputs, errors in `globals.css`**

Replace `.admin-error`, `.admin-btn`, `.admin-btn:disabled`, `.admin-btn-primary`, `.admin-toolbar`, `.admin-realm`, `.admin-realm-head`, `.admin-realm-body`, `.admin-input`, `.admin-input.invalid`, `.admin-field-error` (~lines 1482–1567) with:

```css
.admin-error {
  border: 1px solid var(--red);
  background: rgba(239, 68, 68, 0.12);
  color: #f6b8b8;
  border-radius: var(--radius-sm);
  padding: var(--space-4);
  margin: var(--space-3) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.admin-btn {
  border: 1px solid var(--border-bright);
  background: var(--surface-2);
  color: var(--fg);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  min-height: 40px;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) var(--ease-out);
}

.admin-btn:hover:not(:disabled) {
  border-color: var(--gold);
  background: rgba(251, 191, 36, 0.08);
}

.admin-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-btn-primary {
  background: rgba(251, 191, 36, 0.2);
  color: var(--gold);
  border-color: var(--border-bright);
}

.admin-btn-primary:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.3);
  box-shadow: 0 0 14px var(--gold-glow);
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

/* Realm editor */
.admin-realm {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space-4);
  overflow: hidden;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-panel);
}

.admin-realm-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  min-height: 44px;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1rem;
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-fast) var(--ease-out);
}

.admin-realm-head:hover {
  background: rgba(251, 191, 36, 0.06);
}

/* The last span in the head is the ▾/▸ chevron — rotate the collapsed one via
   aria-expanded so it animates smoothly instead of swapping glyph abruptly. */
.admin-realm-head > span:last-child {
  color: var(--gold);
  transition: transform var(--dur) var(--ease-out);
}

.admin-realm-body {
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--border);
}

.admin-input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--fg);
  padding: var(--space-2);
  width: 100%;
  min-width: 70px;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.admin-input:hover:not(:disabled) {
  border-color: var(--border-bright);
}

.admin-input.invalid {
  border-color: var(--red);
}

.admin-field-error {
  color: #f6b8b8;
  font-size: 0.78rem;
  margin-top: 3px;
}
```

- [ ] **Step 2: Run the gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: all pass.

Run: `pnpm test`
Expected: PASS, count unchanged (48).

- [ ] **Step 3: Visual check**

On `/admin/realms`: each realm is a glass card; header row highlights on hover, chevron is gold. Expand/collapse works (logic unchanged). Toolbar buttons have hover glow; primary "Lưu tất cả" glows gold on hover, dims when disabled. Type an invalid value (e.g. clear a numeric field) → input turns red, field error shows, Save disabled. Undo/save flow unchanged. Check the table scrolls horizontally on 375px.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(admin): glass realm accordion, button hover polish, glass inputs"
```

---

### Task 4: Pills catalog — glass pill cards, glowing rarity glyph, pill-shaped badges, form treatment

**Files:**
- Modify: `frontend/src/app/globals.css` (`.admin-pill-list`, `.admin-pill-card`, `.admin-pill-card.inactive`, `.admin-pill-head`, `.admin-pill-glyph`, `.admin-pill-name`, `.admin-pill-rarity/.admin-pill-stat/.admin-pill-starter`, `.admin-pill-off`, `.admin-pill-form`, `.admin-pill-form-grid`, `.admin-pill-form-grid label`, `.admin-pill-desc`, `.admin-pill-form-grid label.admin-pill-active` — ~lines 1573–1662; add glow, badge shapes, hover)
- (No markup change — classes already exist in `admin/pills/page.tsx`.)

**Interfaces:**
- Consumes: `.admin-btn`/`.admin-btn-primary`/`.admin-input` from Tasks 1/3.
- Produces: nothing.

- [ ] **Step 1: Restyle the pill catalog in `globals.css`**

Replace the entire `/* ---- Admin pill catalog editor ---- */` block (~lines 1573–1662, through the `.admin-pill-active` rule at the end) with:

```css
/* ---- Admin pill catalog editor ---- */
.admin-pill-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.admin-pill-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease-out);
}

.admin-pill-card:hover {
  border-color: var(--border-bright);
}

.admin-pill-card.inactive {
  opacity: 0.6;
}

.admin-pill-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  color: var(--fg);
  font: inherit;
  cursor: pointer;
  text-align: left;
  min-height: 44px;
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

.admin-pill-starter {
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--jade);
  color: var(--jade);
}

.admin-pill-off {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--red);
  color: #f6b8b8;
}

.admin-pill-form {
  padding: var(--space-3) var(--space-4) var(--space-4);
  border-top: 1px solid var(--border);
}

.admin-pill-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.admin-pill-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.admin-pill-desc {
  grid-column: 1 / -1;
}

/* Beats the .admin-pill-form-grid label column layout via specificity (no
   !important): the active toggle is a single checkbox + text row. */
.admin-pill-form-grid label.admin-pill-active {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
}
```

Note: `.admin-pill-starter` previously shared a rule with `.admin-pill-rarity/.admin-pill-stat` (muted text). It is now a jade pill-badge, so it is split out of that shared selector above — verify the collapsed card still reads well.

- [ ] **Step 2: Run the gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: all pass.

Run: `pnpm test`
Expected: PASS, count unchanged (48).

- [ ] **Step 3: Visual check**

On `/admin/pills`: each pill is a glass card; glyph glows in its rarity color; "Tân thủ ×N" is a jade pill-badge, "Đang tắt" a red pill-badge pushed to the right. Card border brightens on hover. Open a card → form appears with glass inputs (from Task 3), Lưu/Hoàn tác buttons styled. Create-new form, edit, active toggle, and validation all behave as before. Inactive pills render dimmed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(admin): glass pill cards, glowing rarity glyphs, badge pills"
```

---

## Self-Review

**Spec coverage:**
- §1 Khung chung (cosmic backdrop, glass header, tabs+icons, loading skeleton) → Task 1. ✓ (Decided: static gradient via `.admin-shell::before`, no starfield canvas — matches spec default.)
- §2 Thống kê (glass cards+accent+icons, stagger, bars+%, hover, empty/error) → Task 2. ✓
- §3 Cảnh giới (glass accordion, chevron, inputs, buttons) → Task 3. ✓ (Decided: toolbar not sticky — matches spec default; realm header IS not sticky, only the top app header is sticky in Task 1.)
- §4 Đan dược (glass pill cards, rarity glow, badges, form transition) → Task 4. ✓
- Accessibility & Motion (focus ring kept, reduced-motion global, ≥44px, contrast, SVG-only) → Global Constraints + per-task ≥44px on nav/buttons/heads. ✓
- YAGNI list (no sidebar, no new charts, no API change, no deps) → Global Constraints. ✓

**Placeholder scan:** No TBD/TODO. One in-plan correction note in Task 2 Step 1 ("do NOT reuse `LogoutIcon`") is intentional guidance, and the final import list is shown explicitly. All CSS/TSX shown in full.

**Type consistency:** New icons `ChartIcon`, `MountainIcon`, `AlertIcon` are defined in Task 1/Task 2 before use. `stats.totalUsers` used for the `%` is a real `AdminStats` field. No new TS types introduced. Class names (`.admin-card--jade/--gold/--red`, `.admin-card-icon`, `.admin-bar-cell`, `.admin-bar-pct`) are defined in the same task's CSS as their markup.

**Motion/overshoot:** Per the ui-ux-pro-max guidance ("don't use back.out on dense data tables"), all reveals use plain `--ease-out` slide+fade, no bounce. ✓
