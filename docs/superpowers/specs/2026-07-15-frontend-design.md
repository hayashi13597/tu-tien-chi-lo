# Frontend Design — Tu Tiên Chi Lộ (Đan Điền Pháp Trận)

Date: 2026-07-15
Status: Approved (design), pending implementation plan

## Goal

Build the Next.js frontend for tu-tien-chi-lo at **full parity** with the working
reference frontend (`/home/hayashi/working/nhat-niem-tieu-dao/frontend`): the same
visuals, the same GSAP animations, and the same feature set (cookie-based auth, an
animated cultivation dashboard, and the breakthrough/tribulation flow). The code is
authored independently for this repo and wired to this repo's backend; it is not a
byte-for-byte transplant. The reference is the design target, not a source to clone.

This frontend consumes the Phase 1 + Phase 2 backend already implemented in
`backend/` (Express, cookie auth with sliding refresh, `/cultivation/state` and
`/cultivation/breakthrough`).

## Non-goals

- No new gameplay features beyond what the reference frontend exposes.
- No backend changes. The backend API is treated as a fixed contract.
- No end-to-end / component test suite. Testing is limited to pure-logic unit tests
  (see Testing).
- No visual redesign. The reference aesthetic is reproduced, not reimagined.

## Stack

Already scaffolded in `frontend/` (matches the reference):

- Next.js 16 (App Router), React 19, TypeScript 5
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- Biome 2 (lint + format)
- **To add:** GSAP 3.15.0 + `@gsap/react` 2.1.2 — required for the animation
  components (dantian formation, particle canvas, tribulation overlay, loading screen,
  toast entrance). Pin the same versions the reference uses.

Verify the exact API shape of each library against its pinned version via context7
(`ctx7`) before writing library-specific code, per the CLAUDE.md mandatory rule.
Especially: Next.js 16 App Router conventions and the `@gsap/react` `useGSAP` hook —
Next 16 has breaking changes vs. training data (see `frontend/AGENTS.md` if present, or
the reference's, which points at `node_modules/next/dist/docs/`).

## Architecture & layering

The Clean Architecture rule in CLAUDE.md governs the **backend**. The frontend follows
the reference's own idiomatic layering, which honors the same principle — dependencies
point toward pure, framework-light logic:

```
frontend/src/
  lib/            # framework-light core
    types.ts            # API contract types
    api.ts              # fetch wrapper + silent 401->refresh->retry
    auth-context.tsx    # AuthProvider + useAuth (session state)
    realm-constants.ts  # realm metadata + lookups (pure)
    format.ts           # number/time formatters (pure)
  hooks/
    use-cultivation-state.ts  # poll + interpolate + countdown
    use-toast.ts              # transient toast queue
  components/       # presentational + GSAP animation units
    cosmic-background.tsx
    loading-screen.tsx
    toast-container.tsx
    dantian-formation.tsx
    particle-canvas.tsx
    lingqi-bar.tsx
    realm-path.tsx
    stats-panel.tsx
    quick-menu.tsx
    breakthrough-button.tsx
    breakthrough-overlay.tsx
  app/
    layout.tsx      # fonts + AuthProvider
    login/page.tsx  # login/register tabbed form
    page.tsx        # dashboard orchestrator
    globals.css     # themed stylesheet (~1074 lines: vars, styles, keyframes)
```

Rule: `components/` and `app/` depend on `hooks/` and `lib/`; `hooks/` depend on
`lib/`; `lib/`'s pure modules (`types`, `format`, `realm-constants`) depend on nothing.
`api.ts` and `auth-context.tsx` depend only on the browser `fetch` and React.

## Backend contract (verified)

The backend's response shapes match the reference frontend's `types.ts` exactly
(confirmed by reading `GetCultivationStateUseCase` output and the cultivation routes):

- `GET /cultivation/state` → `CultivationState`
  `{ realmMajor, realmSub, realmName, linhKhi, linhKhiRequired, canBreakthrough,
     isMaxStage, punishedUntil (ISO string | null), cultivationRate }`
- `POST /cultivation/breakthrough` → `BreakthroughResult`
  `{ success, character: { id, userId, realmMajor, realmSub, linhKhi, lastUpdateAt,
     breakthroughFails, punishedUntil, createdAt } }`
- `POST /auth/register`, `POST /auth/login` — set httpOnly `access_token` /
  `refresh_token` cookies; JSON body unused by the client beyond success/failure.
- `POST /auth/refresh` — cookie-only, sliding renewal; 401 when refresh invalid.
- `POST /auth/logout` — always 200, clears cookies.
- Error body shape: `{ error: { code, message } }` → `ApiError`.

**Required config difference from the reference:** this repo's backend serves on
**port 5000** (the reference used 3000, now taken by the frontend dev server). Therefore:

- `frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://localhost:5000`
- `api.ts` default fallback: `process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000"`
- The backend already sets `CORS_ORIGIN=http://localhost:3000` (the frontend dev
  origin) with `credentials: true`, so cross-origin cookie auth works in dev.

## Components & responsibilities

**lib/ (pure / framework-light)**

- `types.ts` — `CultivationState`, `BreakthroughResult`, `ApiError`, `ToastItem`.
- `format.ts` — `formatNum` (K/M suffixes), `formatSeconds` (m:ss),
  `formatTimeAgo` (s / m s / h m). Pure → unit tested.
- `realm-constants.ts` — `REALM_META` (12 realms: name, glyph, color, desc),
  `SUB_STAGE_NAMES`, `RING_CHARS` (per-ring Hanzi), `getRealmMeta`,
  `getSubStageName` (both with out-of-range fallback to index 0). Pure → unit tested.
- `api.ts` — `apiFetch<T>(path, options)`: always `credentials: 'include'`, JSON
  content-type, spreads caller options/headers. On `401` (and path is not
  `/auth/refresh`, and not already refreshing): POST `/auth/refresh`; on success replay
  the original request once; on failure throw `Error("Authentication expired")`.
  Non-OK responses throw `Error(err.error.message ?? "HTTP <status>")`. Guarded by a
  module-level `isRefreshing` flag to avoid concurrent refreshes. Exports `API_BASE`.
  Refresh/retry logic → unit tested (fetch mocked).
- `auth-context.tsx` — `AuthProvider` + `useAuth`. State: `isAuthenticated`,
  `isLoading`. On mount, probe `GET /cultivation/state` to establish session
  (success → authenticated). `login`/`register` POST then set authenticated;
  `logout` POSTs `/auth/logout` (direct fetch, credentials include) then clears state.

**hooks/**

- `use-cultivation-state.ts` — inputs `(isAuthenticated, onAuthExpired)`. Polls
  `/cultivation/state` every 10s; keeps a 1s `now` tick; exposes `state`, `error`,
  `loading`, `refetch`, `displayLinhKhi` (interpolated:
  `state.linhKhi + elapsedSincePoll * state.cultivationRate`), `punishmentRemaining`
  (seconds until `punishedUntil`, else null), `now`. On an "Authentication expired"
  error, calls `onAuthExpired` instead of setting `error`.
- `use-toast.ts` — `toasts`, `addToast(title, message, type)`, `removeToast(id)`.
  Auto-dismiss after 3500ms. Types: `success | danger | purple | info`.

**components/ (presentational + GSAP)**

- `cosmic-background.tsx` — layered radial/linear gradient backdrop + drifting stars.
- `loading-screen.tsx` — GSAP intro fade/spinner; self-dismisses.
- `toast-container.tsx` — renders the toast queue with GSAP entrance; dismiss on click.
- `dantian-formation.tsx` — the centerpiece: concentric rings of rotating Hanzi
  (`RING_CHARS`) animated with GSAP; the realm glyph in the core.
- `particle-canvas.tsx` — `forwardRef` exposing an imperative handle
  `{ spawnAbsorption(n), spawnBurst(color, n) }`; a `<canvas>` particle system driven
  by `requestAnimationFrame`. Ambient absorption particles during idle; burst on
  successful breakthrough.
- `lingqi-bar.tsx` — linh-khí progress bar (`displayLinhKhi / linhKhiRequired`) with
  formatted numerator/denominator.
- `realm-path.tsx` — the 12-realm progression rail, highlighting the current realm.
- `stats-panel.tsx` — modal contents: realm, sub-stage, rate, punishment countdown.
- `quick-menu.tsx` — floating action menu; opens the stats modal.
- `breakthrough-button.tsx` — states: attemptable / not-ready / max-stage /
  punished (with countdown). On click, POSTs `/cultivation/breakthrough` and reports
  `onSuccess(result)` / `onFailure(result)` / `onError(message)` up, plus `onAttempt`.
- `breakthrough-overlay.tsx` — exports `BreakthroughPhase`
  (`idle | tribulating | success | failure`); GSAP tribulation sequence; calls
  `onComplete` when the tribulating animation finishes so the parent can resolve.

**app/**

- `layout.tsx` — loads Ma Shan Zheng, ZCOOL XiaoWei, Be Vietnam Pro via
  `next/font/google` as CSS variables; wraps children in `AuthProvider`; sets metadata
  (title "Tu Tiên Chi Lộ — Đan Điền Pháp Trận", `lang="vi"`).
- `login/page.tsx` — tabbed login/register form (username 3–32, password 8–72),
  client-side redirect to `/` when already authenticated; submit errors shown inline.
- `page.tsx` — dashboard orchestrator: wires `useAuth`, `useCultivationState`,
  `useToast`; renders header/quick-menu/cultivation stage/realm path; owns the
  breakthrough phase state machine (below); redirects to `/login` when unauthenticated.
- `globals.css` — the full themed stylesheet: CSS variables (jade/gold/purple/red
  palette), every component's styles, keyframes. Reproduce the reference's visual result.

## Data flow

**Session establishment.** `AuthProvider` mounts → `GET /cultivation/state`. 2xx ⇒
authenticated; error ⇒ not. `isLoading` true until that probe resolves. Route guards:
`page.tsx` redirects to `/login` when `!isAuthenticated`; `login/page.tsx` redirects to
`/` when authenticated.

**Token refresh.** `apiFetch` relies on httpOnly cookies (`credentials: 'include'`);
JS never reads tokens. A `401` triggers one silent `POST /auth/refresh`; on success the
original request is replayed once; on failure it throws `"Authentication expired"`,
which `use-cultivation-state` maps to `onAuthExpired()` → redirect to `/login`. The
`isRefreshing` flag prevents a refresh storm when multiple calls 401 at once.

**Cultivation loop.** `/cultivation/state` polled every 10s is the source of truth.
Between polls a 1s tick interpolates `displayLinhKhi` upward from `cultivationRate` so
the bar animates smoothly; `punishedUntil` drives a live countdown that disables the
breakthrough button.

**Breakthrough state machine** (owned by `page.tsx`):

1. `idle` → user clicks → set `tribulating`, show "Thiên Kiếp" toast. The POST result
   (or error) is stashed in refs while the overlay plays.
2. `breakthrough-overlay` finishes its tribulating animation → `onComplete` fires.
3. Resolve: if an error was stashed → back to `idle` + danger toast. If
   `result.success` → `success` phase: particle burst in the new realm's color +
   success toast, then `idle` after ~1.8s. Else → `failure` phase: danger toast, then
   `idle` after ~1.5s.
4. Always `refetch()` afterward to reconcile with the server.

## Error handling

- API/network errors → `Error(message)` from `apiFetch`; surfaced inline in the login
  form or as danger toasts on the dashboard.
- Auth expiry → redirect to `/login` (never a raw error to the user).
- Null/missing character state → a retry card with a "Thử Lại" button calling `refetch`.
- Breakthrough errors while idle → danger toast; during a tribulation they are
  deferred and resolved at `onComplete`.

## Testing

Scope: **pure-logic unit tests only** (per decision). Add Vitest + jsdom + a `test`
script (`"test": "vitest run"`). Cross-check Vitest config shape against its pinned
version via context7 before writing it.

- `format.test.ts` — `formatNum` (sub-1k, K, M boundaries), `formatSeconds`
  (zero-pad seconds), `formatTimeAgo` (s / m s / h m thresholds).
- `realm-constants.test.ts` — `getRealmMeta`/`getSubStageName` return correct entries
  and fall back to index 0 for out-of-range input; `REALM_META` has 12 entries.
- `api.test.ts` — with `fetch` mocked: (a) 401 → refresh 200 → retry → returns data;
  (b) 401 → refresh fails → throws "Authentication expired"; (c) non-401 error → throws
  mapped message; (d) a `/auth/refresh` 401 does not recurse.

Animated and presentational components (dantian formation, particle canvas, overlay,
etc.) are **verified manually in-browser**: `docker compose up` the backend, run the
frontend dev server, then register → cultivate (bar climbs) → breakthrough
(success and failure paths) → logout. Manual verification is the acceptance gate for
visual parity, since no snapshot/visual tests are in scope.

## Environment & commands

- `frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://localhost:5000`
- Backend (separate terminal): `cd backend && docker compose up -d --build`
- Frontend dev: `cd frontend && pnpm install && pnpm dev` (serves on :3000)
- Lint/format: `pnpm lint` / `pnpm format` (Biome)
- Tests: `pnpm test` (Vitest)

## Acceptance criteria

1. `/login` supports register and login; both set cookies and land on the dashboard.
2. Dashboard renders the dantian formation, cosmic background, realm display, linh-khí
   bar (climbing between polls), realm path, and quick menu — matching the reference.
3. Breakthrough: success plays the tribulation overlay + particle burst + advances the
   realm; failure plays the failure path; punishment disables the button with a live
   countdown; max stage disables it.
4. A 401 mid-session silently refreshes and continues; an unrecoverable auth failure
   redirects to `/login`. Logout clears the session and redirects.
5. `pnpm lint` clean, `pnpm test` green, TypeScript compiles.
6. CLAUDE.md updated with the frontend architecture and commands (per mandatory rule).
