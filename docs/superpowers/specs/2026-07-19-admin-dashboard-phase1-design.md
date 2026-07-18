# Admin Dashboard — Phase 1 (Shell + Realm Config UI + Basic Stats)

**Date:** 2026-07-19
**Status:** Approved
**Branch:** `feat/admin-dashboard` (branched from `feat/realm-config-db` — depends on `User.role`, `requireAdmin`, and `GET/PUT /admin/realms` from that branch; same layering approach as 4b built on the dan-duoc branches)

## Goal

A web dashboard for admins inside the existing Next.js frontend. Phase 1 delivers the admin shell (route guard, layout, navigation), a Realm Config editor UI on top of the existing `GET/PUT /admin/realms` API, and a basic stats overview page. Player management and pill-catalog management are explicitly out of scope — each gets its own later spec → plan → implementation cycle.

## Scope decisions (from brainstorming)

- **Phased delivery:** this spec = shell + realm config UI + basic stats. Player management and pill catalog are future phases.
- **Same Next.js app:** `/admin` routes in the existing frontend. Reuses cookie auth and `apiFetch` refresh-retry. Admin gets its own minimal layout — no game background, no GSAP.
- **Stats = basic counts only:** computed live via Prisma aggregates; no event-log table, no time series.
- **Realm editor = inline table + Save All:** accordion per realm, editable sub-stage table, one full-replace PUT — matching the backend's replace-all API.
- **Role detection = new `GET /auth/me`:** frontend calls it once to gate `/admin` and to show the "Quản trị" menu item.

## Backend additions

Two endpoints; no new tables, no migrations.

### `GET /auth/me` (requireAuth)

Returns `{ id, username, role }`. `id` and `role` come from the verified access token (no DB read for them); `username` needs one `users.findById`. Thin use case:

```
GetCurrentUserUseCase(users: UserRepository)
  execute({ userId, role }): Promise<{ id, username, role }>
```

If the user no longer exists (deleted but token still valid) → `DomainError('USER_NOT_FOUND')`, mapped to **401** in `errorHandler`'s status map (new code, one line).

### `GET /admin/stats` (requireAuth + requireAdmin)

```json
{
  "totalUsers": 123,
  "totalAdmins": 2,
  "realmDistribution": [
    { "realmMajor": 0, "realmName": "Phàm Nhân", "count": 87 }
  ],
  "punishedCount": 5
}
```

- New domain port `StatsRepository`:
  ```
  interface StatsRepository {
    countUsers(): Promise<number>
    countAdmins(): Promise<number>
    countCharactersByRealm(): Promise<{ realmMajor: number; count: number }[]>
    countPunished(now: Date): Promise<number>
  }
  ```
- `PrismaStatsRepository`: `user.count()`, `user.count({ where: { role: 'admin' } })`, `character.groupBy(['realmMajor'])`, `character.count({ where: { punishmentUntil: { gt: now } } })`.
- `GetAdminStatsUseCase(stats: StatsRepository, realmConfig: RealmConfigSource)` maps `realmMajor → realmName` via the cached `RealmConfigSet`; a realm no longer present in config (admin deleted it while characters still sit there) renders as `"Realm #N"` instead of throwing.
- `realmDistribution` is sorted by `realmMajor` ascending.
- No new domain error codes for stats — 401/403 are handled by middleware.

### Wiring

`app.ts`: construct `PrismaStatsRepository`, `GetAdminStatsUseCase`, `GetCurrentUserUseCase`; mount `GET /auth/me` on the auth router and `GET /admin/stats` on the existing admin router (already behind `requireAuth + requireAdmin`).

## Frontend

### Routes

```
src/app/admin/
  layout.tsx      — guard + admin shell (header with nav + "← Về game", minimal static styling)
  page.tsx        — stats overview (default /admin page)
  realms/page.tsx — realm config editor
```

### Guard (`admin/layout.tsx`, client component)

On mount, call `fetchMe()` (through `apiFetch` → cookies + silent refresh-retry included):

- 401 / "Authentication expired" → redirect `/login`
- `role !== "admin"` → redirect `/`
- admin → render children. While pending: simple loading placeholder (not the game loading screen).

The guard is client-side UX only — **real security is the backend's `requireAuth + requireAdmin` on every admin API**. No Next.js middleware needed.

### Role in the game UI

`auth-context` gains a `me` state populated by `fetchMe()` so the admin layout and `HeaderMenu` share one fetch. `HeaderMenu` shows a "Quản trị" item (→ `/admin`) only when `me.role === "admin"`. Non-admins see no link; typing `/admin` directly bounces them to `/`.

### Data layer

`lib/api.ts` gains `fetchMe()`, `fetchAdminStats()`, `fetchAdminRealms()`, `updateAdminRealms(realms)` — all via `apiFetch`. `lib/types.ts` gains `Me`, `AdminStats`, `RealmConfigDTO` (matching the backend's `{ realms: [{ name, subStages: [{ subStageName, linhKhiRequired, cultivationRate, baseSuccessRate, pityIncrement, maxSuccessRate, punishmentSeconds }] }] }` shape).

### Stats page (`/admin`)

- Three stat cards: total users, total admins, currently punished.
- Realm distribution as a table with CSS horizontal bars (no chart library).
- Manual "Làm mới" refetch button — no auto-polling; admin stats don't need realtime.

### Realm editor (`/admin/realms`)

- Accordion: one collapsible section per realm; header shows realm name + sub-stage count.
- Inside: a sub-stage table with a text input for `subStageName` and number inputs for the six tunables; a text input for the realm `name`.
- Add/remove realm and add/remove sub-stage buttons (free structural editing, mirroring the backend contract).
- **Draft state:** edits are local until "Lưu tất cả" sends one full-replace PUT. "Hoàn tác" resets the draft to the last server copy. Leaving the page with unsaved changes triggers a confirm (`beforeunload` + guard on in-app nav links).
- **Client validation before PUT** (mirrors backend invariants): ≥1 realm; each realm ≥1 sub-stage; names non-empty; `linhKhiRequired`/`cultivationRate` > 0; rates within 0–100; `punishmentSeconds` ≥ 0 integer; `linhKhiRequired` strictly increasing **within each realm** (cross-realm resets are legal). Invalid fields get a red outline + message; Save is disabled while invalid.
- Server 400 (`INVALID_REALM_CONFIG`) → red banner with the server message, draft preserved.
- After a successful save, the draft is re-synced from the response/refetch.

Validation lives in a pure `lib/realm-validation.ts` (`validateRealmDraft(realms): FieldError[]`) so it is unit-testable without React.

### Styling

Reuse the color/font tokens from `globals.css` (keep the cultivation aesthetic) but the admin shell is a minimal table-and-form layout: static background, no canvas, no GSAP.

## Error handling

- **Backend:** `USER_NOT_FOUND` → 401 (new `errorHandler` mapping). Everything else reuses existing codes.
- **Frontend:** every admin fetch failure renders an in-page error block with a "Thử lại" button (same pattern as `pill-modal`). Failed PUT keeps the draft intact and shows the server message. Auth expiry inside `/admin` redirects to `/login` (the `apiFetch` "Authentication expired" path).

## Testing

- **Backend unit:** `GetCurrentUserUseCase` (returns DTO; missing user → `USER_NOT_FOUND`), `GetAdminStatsUseCase` (realmName mapping; deleted realm → `"Realm #N"`; punished count) against a new `InMemoryStatsRepository` fake; `errorHandler` +1 case (`USER_NOT_FOUND` → 401).
- **Backend integration:** `auth.me.test.ts` (cookie → 200 + shape; no cookie → 401); `admin.stats.test.ts` (non-admin → 403; admin → counts match data seeded by the test itself).
- **Frontend unit:** `realm-validation.test.ts` (~6 cases: valid config passes, empty realms, empty name, non-increasing within realm, cross-realm reset allowed, out-of-range rate); stub-fetch tests for the four new api functions (existing `api.test.ts` pattern).
- **Components/animation:** human-observation gate, as in all prior phases — no snapshot tests.

## Verification

Backend `npm test` + typecheck green; frontend lint / tsc / tests / build green. Manual Docker pass:

1. Login as admin → game header menu shows "Quản trị".
2. `/admin` stats match the DB state.
3. `/admin/realms`: edit a value → Lưu tất cả → a player's `/cultivation/state` reflects it immediately (provider live-reload).
4. Invalid edit (non-increasing within a realm) → inline client error; force an invalid PUT → 400 banner.
5. Login as a normal user → no "Quản trị" link; direct `/admin` navigation redirects to `/`.

## Out of scope

- Player management (list/search users, promote/demote admin, edit character state) — next phase.
- Pill catalog management — later phase.
- Time-series stats / event logging.
- Next.js middleware-based route protection (client guard + backend enforcement is sufficient).
- Admin self-service bootstrap (stays SQL-only: `UPDATE "User" SET role='admin' …`).
