# Admin Pro-Dashboard Rebuild — Design Spec

Date: 2026-07-21
Branch: `feat/admin-redesign` (continues from the just-shipped cosmic/glass redesign)
Status: Approved (brainstorming)

## Goal

Full frontend-only rebuild of the three admin pages — `/admin` (stats), `/admin/realms`
(realm config editor), `/admin/pills` (pill catalog) — plus their shared shell
(`admin/layout.tsx`). Replace the "cosmic/glass game screen" register with a calm, dense
**pro-dashboard / control-panel** register: faster to scan data and edit, flatter surfaces,
tighter spacing, less ambient glow/blur.

## Non-Goals / Constraints

- **Frontend-only.** No backend, API, DTO, validation, or business-logic changes. Same
  endpoints (`GET /auth/me`, `GET /admin/stats`, `GET/PUT /admin/realms`,
  `GET/POST/PUT /admin/pills`), same request/response shapes.
- **No dependency changes.** Reuse existing `globals.css` design tokens
  (`--gold`/`--jade`/`--red`/`--purple`, `--surface*`, spacing/radius/motion scale) and
  existing icons/components.
- **All interaction logic preserved exactly**: guards, draft/undo/save state machines,
  per-field validation (`validateRealmDraft`/`findError`, `validatePillDraft`/`findPillError`),
  `disabled={saving}` discipline, `beforeunload` unsaved-changes warnings, unsaved-switch
  confirms, NaN-blocks-save numeric convention, index-remap on realm removal. This rebuild
  reshapes **layout + presentation + component containers only**.
- **No new tests.** These are presentational reshapes; the existing 48 pure-logic frontend
  tests (`realm-validation`, `pill-validation`, api stubs) must stay green untouched. Visual
  parity is a human-observation gate, consistent with prior admin work.

## Visual Direction

Keep the established dark palette and gold/jade/red/purple accent tokens, but shift their
role from **ambient chrome** (glow, `blur(20px)`, heavy gradients) to **status/semantic
accents** (thin left-accent bars, tint dots, single-hue bars). Reference: UI-UX-Pro-Max
"Real-Time / Operations" pattern at density 8 / motion 3 / variance 4 — dense but scannable,
status colors, subtle 300ms fade motion, monospace for numeric data. We adopt its *structure
and density*, not its suggested blue/amber palette (we keep our tokens).

Concrete rules:
- Panels: solid elevated surface + 1px `--border`, `--radius`. Drop `backdrop-filter: blur`
  and multi-stop gradients on data panels. Glass/blur is retained only on the sticky
  topbar/rail chrome if it reads well; data areas are flat.
- Numbers (KPI values, counts, percentages, tunable fields) render in a monospace stack so
  columns align and scan cleanly. Add a `--font-mono` fallback stack in CSS (system monospace,
  no new web font import).
- Motion: a single subtle content fade-in on page mount (~300ms, small y-offset). The global
  `@media (prefers-reduced-motion: reduce)` block already neutralizes it — no per-rule guard.
- Accessibility carried forward: ≥44px touch targets on nav/actions, visible focus rings
  (global `:focus-visible`), every field keeps a visible label, contrast ≥4.5:1.

## Section 1 — Shell & Navigation (`admin/layout.tsx`)

Replace the sticky-topbar + underline-tabs + centered 1100px column with a **sidebar shell**:

- **Left rail** (~220px desktop): brand wordmark ("Quản trị"), vertical nav items with icon +
  label reusing `ChartIcon` (Thống kê), `MountainIcon` (Cảnh giới), `CauldronIcon` (Đan dược).
  Active item = solid left-accent bar + filled background (not a glow underline).
  "← Về game" pinned at the bottom of the rail.
- **Topbar** (thin, above content): per-page title on the left, a slot for the page's primary
  action on the right. The layout renders the title/action slot; pages fill it. (Simplest:
  each page renders its own topbar row via a shared `.admin-topbar` class inside its
  `<section>`, keeping the layout dumb — no context/portal machinery. The layout provides the
  rail + a content region; the page owns its title + action row.)
- **Content region**: full-width (within a sensible max, e.g. the rail + fluid main), dense.
- **Mobile (≤768px)**: rail collapses to a horizontal row of icon+label tabs at the top;
  content below. Only 3 destinations + back link — no hamburger.
- Loading/guard placeholder (`isLoading || role !== admin`) stays: a plain centered skeleton
  (unchanged behavior — deliberately not the game's animated loader). Guard logic (redirect
  unauthenticated → `/login`, non-admin → `/`) is unchanged; real enforcement remains the
  backend middleware.

## Section 2 — Thống kê (`admin/page.tsx`)

Data unchanged: `AdminStats = { totalUsers, totalAdmins, punishedCount, realmDistribution[] }`.

- **KPI strip — 4 compact tiles** in a responsive row:
  1. Tổng người chơi (`totalUsers`, jade)
  2. Quản trị viên (`totalAdmins`, gold)
  3. Đang chịu phạt (`punishedCount`, red)
  4. Cảnh giới đông nhất — **derived client-side** from `realmDistribution` (the realm with
     the max `count`; show its `realmName`, purple). No new API. Handle empty distribution →
     "—".
  Each tile: monospace hero number/value, small label, a role-tinted left-accent bar or dot.
  Flat panel (no top-glow).
- **Distribution panel**: a titled panel with a header row (title + total `totalUsers`), then
  a dense table — realm name | single-hue bar (width relative to max count, thin, no heavy
  glow) | right-aligned monospace count | right-aligned monospace `%`-of-total. Subtle zebra +
  hover highlight. Empty distribution → inline "Chưa có nhân vật nào." row.
- **States**: loading and error render as inline panels (error keeps "Thử lại"); a
  refresh-proof 401 still routes to `/login`. Manual "Làm mới" lives in the topbar action slot;
  no polling.

## Section 3 — Cảnh giới (`admin/realms/page.tsx`)

Replace the accordion + horizontally-scrolling sub-stage table with a **master/detail** layout.
State machine, validation, and save flow are unchanged; only the presentation and the
selection model change.

- **Master (left list)**: every realm as a selectable row — `#index`, name, sub-stage count,
  and an error dot when that realm has validation errors. "+ Thêm cảnh giới" at top;
  "Hoàn tác" / "Lưu tất cả" (disabled per existing rules: not dirty, has errors, or saving) +
  dirty/saved-timestamp indicator pinned at the bottom of the rail. A global/top-level
  validation error (e.g. "≥1 realm") shows above the list.
- **Detail (right pane)**: the selected realm — name field (with inline error), a "Xóa cảnh
  giới" action, then **one card per sub-stage**. Each card: the sub-stage name field + the 6
  numeric fields (`linhKhiRequired`, `cultivationRate`, `baseSuccessRate`, `pityIncrement`,
  `maxSuccessRate`, `punishmentSeconds`) in a responsive **labeled 2-column grid** — every
  field has a visible label (fixes today's header-row-only labeling), **no horizontal scroll**.
  Per-field inline errors preserved. Per-card "Xóa" (remove sub-stage) + "+ Thêm tiểu cảnh
  giới" below the cards. The add-sub-stage seed-from-previous logic is unchanged.
- **Selection model**: the index-keyed `openRealms: Set<number>` becomes a single
  `selectedRealm: number`. On realm removal, remap selection the same way the old code remapped
  the open set (drop/decrement indices above the removed one; clamp to a valid realm).
- All controls carry `disabled={saving}`; `beforeunload` fires while `dirty`. `updateDraft`,
  `setRealmName`, `setSubField`, `addRealm`, `removeRealm`, `addSubStage`, `removeSubStage`,
  `save`, `undo` keep their current behavior.

## Section 4 — Đan dược (`admin/pills/page.tsx`)

Replace the one-per-row list-with-inline-expand with a **responsive card grid + a dedicated
editor panel**. `PillForm` is reused essentially as-is; only its container placement changes.

- **Card grid**: `repeat(auto-fill, minmax(~200px, 1fr))` of compact pill cards — glyph in
  rarity color (keep the glyph-only `drop-shadow(currentColor)` glow; it's an identity element,
  not ambient chrome), name, rarity label, one-line effect summary (`headlineStat`),
  `Tân thủ ×N` and `Đang tắt` badges. Selected card gets a highlight ring; inactive cards
  dimmed (existing `.inactive`).
- **Editor panel**: opening a card (or "+ Thêm") shows `PillForm` in a right-hand panel on
  desktop / a full-width section (drawer-style) on mobile — instead of expanding inline in the
  middle of the grid, so the grid stays stable while editing. Create mode uses `emptyPill()`,
  id editable; edit mode uses the selected pill, id read-only.
- **`PillForm` unchanged**: draft state, `validatePillDraft`/`findPillError`, `statsForKind`
  reset on effect-kind change, `PILL_KIND_FIELDS`, NaN-blocks-save numeric convention,
  `onDirtyChange` → `beforeunload`, save (`createAdminPill`/`updateAdminPill`), server-error
  surfacing (`PILL_ID_TAKEN` etc.). Switching selection while a form is dirty keeps the
  existing `window.confirm` guard (`requestOpen`).
- **States**: loading/error/empty as inline panels (error keeps "Thử lại").

## CSS Plan

All changes live in the `.admin-*` block of `frontend/src/app/globals.css` (currently
lines ~1386–1867, end of file). This block is rewritten to the new shell/grid/panel system.
New/changed class families (approximate): `.admin-shell` (grid: rail + main), `.admin-rail`,
`.admin-rail-nav`, `.admin-topbar`, `.admin-kpi`/`.admin-kpi-tile`, `.admin-panel`,
`.admin-dist-*`, `.admin-realm-layout` (master/detail grid), `.admin-realm-list*`,
`.admin-substage-card` + labeled-grid, `.admin-pill-grid`, `.admin-pill-editor`. Existing
utility classes that still fit (`.admin-btn`, `.admin-input`, `.admin-field-error`,
`.admin-error`, `.admin-toolbar`) are kept/retuned. Add a `--font-mono` fallback stack and a
`.admin-num` (or equivalent) monospace utility for numeric cells/values.

Responsive: the rail→top-tabs and master/detail→stacked and editor-panel→drawer collapses all
key off a single `≤768px` media query, matching the rest of the app.

## Testing & Verification

- No new automated tests. Existing frontend suite (48 tests) must stay green — none of the
  reshaped files' pure-logic dependencies change.
- Gate per page: `pnpm lint` / `pnpm tsc --noEmit` / `pnpm test` / `pnpm build` (all 3 admin
  routes present in build output).
- Human-observation visual pass at 375 / 768 / 1024 / 1440px for each page: nav active states,
  KPI + distribution rendering, realm master/detail selection + validation + save/undo, pill
  grid + editor panel + create/edit/disable, all `beforeunload`/confirm guards intact.
- Backend untouched → no backend test run required beyond confirming no backend files changed.

## Risks

- **Realms selection-remap regressions**: collapsing `Set<number>` → single index must
  preserve the remove-and-remap behavior or selection attaches to the wrong realm. Mirror the
  existing `removeRealm` set-remap logic exactly.
- **Losing a preserved behavior during the reshape**: the state machines are intricate
  (dirty/undo/save, beforeunload, confirm-on-switch). Reshape by moving JSX into new
  containers, not by rewriting handlers.
- **Density vs. touch targets**: dense layout must still honor ≥44px targets and 4.5:1
  contrast — verify in the visual pass.
