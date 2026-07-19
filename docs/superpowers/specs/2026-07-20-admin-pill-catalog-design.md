# Admin Pill Catalog Management — Design

**Date:** 2026-07-20
**Branch:** `feat/admin-pills` (from `main`)
**Depends on:** Admin dashboard phase 1 (`/admin` shell, `requireAdmin`, `User.role`), Phase 4 backend Đan Dược (`Pill` table, `PillRepository`, `ConsumePillUseCase`).

## Goal

Let an admin manage the pill (đan dược) catalog at runtime from the admin dashboard — create new pills, edit existing definitions, and enable/disable pills — replacing the current workflow of editing `prisma/seed.ts` and re-running the seed. Same motivation as the realm-config-in-DB feature: retune the game with no redeploy.

**Out of scope:** managing individual players' inventories (grant/revoke pills per user) — a future player-management phase. Hard deletion of pills — disabled pills cover the need without FK or data-loss problems.

## Decisions (settled during brainstorming)

1. **Scope: catalog editor only.** CRUD over pill definitions, not player inventories.
2. **Removal is soft-disable, never delete.** `Pill.active` flag. A disabled pill disappears from player inventories and cannot be consumed, but `InventoryItem` rows are untouched — re-enabling restores players' held quantities instantly. No FK conflicts, no destroyed data.
3. **Starter inventory folds into the pill row.** New `Pill.starterQuantity` column replaces the hardcoded `STARTER_INVENTORY` constant; registration seeds from the DB.
4. **API shape: per-pill CRUD** (`GET` list, `POST` create, `PUT /:id` update) — not the realms-style full-replace `PUT`, because a pill absent from a replace payload would have dangerous implicit-disable semantics, and per-row writes fit the FK reality better.

## Data model

Migration `pill_admin` — two new columns on `Pill`:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `active` | `Boolean` | `true` | Soft-disable. Inactive ⇒ hidden from `GET /pills/inventory`, consume → 404 `PILL_NOT_FOUND` (players cannot distinguish a disabled pill from a nonexistent one). `InventoryItem` rows untouched. |
| `starterQuantity` | `Int` | `0` | Quantity granted to a newly registered user. Replaces the hardcoded `STARTER_INVENTORY`. |

Seed changes: `prisma/seed.ts` sets each existing pill's `starterQuantity` to today's hardcoded values (hoi-khi-dan 5, tu-linh-dan 3, cuu-chuyen-kim-dan 1, tinh-tam-dan 2, ngung-than-dan 1, pha-canh-dan 2, thien-cang-dan 1, giai-phat-dan 2), so registration behavior is unchanged after migration + seed. Caveat (pre-existing, same as realm config): the seed upserts with full update, so re-running `npm run db:seed` overwrites admin edits with seed values — the seed is a fresh-setup/reset tool, not a routine command.

### Behavioral consequences (intentional)

- **Edits apply immediately to already-held pills.** Consume reads the current definition (`findById`) at consume time — no snapshot. Changing `amount` 50→80 changes what every held Hồi Khí Đan does from that moment. This mirrors the realm-config live-retune model.
- **`id` is immutable after creation.** It is the FK key for inventories; the editor never allows changing it (update routes take id from the URL, not the body).
- **No provider/cache layer needed.** Unlike realm config (in-memory `RealmConfigProvider`), pills are already read from the DB per request, so writes are live with no reload step.

## Backend

### Domain (`src/domain/pills/`)

- `PillRecord` gains `active: boolean`, `starterQuantity: number`.
- New pure function `validatePillDefinition(pill)` (framework-free, alongside `pill.calc.ts`) enforcing the invariants zod ranges can't express per `effectKind`:
  - `linhKhi`: `amount > 0`; `cultivationBuff`: `multiplier > 1` and `durationSec > 0`; `breakthroughBoost`: `bonusPct > 0`; `clearPunishment`: no stat fields.
  - Stat fields not belonging to the pill's `effectKind` must be `null` (no orphaned values).
  - `rarity` integer 0–4; `starterQuantity` integer ≥ 0; `name`/`glyph`/`desc` non-empty.
  - Violation → `DomainError('INVALID_PILL_CONFIG', <message>)`.

### Port (`PillRepository`)

New admin methods:

- `listAll(): Promise<PillRecord[]>` — full catalog including inactive (admin-only path).
- `create(record: PillRecord): Promise<void>`.
- `update(record: PillRecord): Promise<boolean>` — full-row update by `id`; returns `false` when the id doesn't exist.

Changed behavior on existing methods:

- `listInventory` additionally filters `pill.active = true` (relation filter) — disabled pills vanish from the player inventory response.
- `seedStarterInventory` drops the `STARTER_INVENTORY` constant and reads the DB: grants every pill with `active AND starterQuantity > 0` at its `starterQuantity`.

`PrismaPillRepository` and the `InMemoryPillRepository` fake both updated. The `STARTER_INVENTORY` export is deleted.

### Application

Three new thin use cases (same shape as `UpdateRealmConfigUseCase`):

- `ListPillsAdminUseCase` — returns the full catalog, inactive included.
- `CreatePillUseCase` — runs `validatePillDefinition`; detects duplicates via `findById` before creating → `DomainError('PILL_ID_TAKEN')`. (A concurrent create racing past the check hits the DB primary-key constraint and surfaces as a 500 — acceptable for an admin-only path, same trade-off as not wrapping it in a transaction.) Id format (`^[a-z0-9-]+$`, non-empty) is validated by zod at the presentation layer.
- `UpdatePillUseCase` — runs `validatePillDefinition`; unknown id → `PILL_NOT_FOUND` (existing code). Enable/disable flows through here (`active` is just a field of the record).

Changed: `ConsumePillUseCase` adds one guard after `findById`: `!pill.active` → throw `PILL_NOT_FOUND` (same error as a missing pill — no catalog information leaks to players).

### Presentation

Routes added to the existing `createAdminRouter` (already behind `requireAuth` + `requireAdmin`):

- `GET /admin/pills` → `200 { pills: PillRecord[] }` (full catalog).
- `POST /admin/pills` — zod schema with all fields including `id` → `201` created record.
- `PUT /admin/pills/:id` — zod schema **without** `id` (taken from the URL) → `200` saved record.

`errorHandler` mappings added: `INVALID_PILL_CONFIG` → 400, `PILL_ID_TAKEN` → 409.

## Frontend

### Data layer

- `types.ts`: new `AdminPillDTO` (all fields incl. `active`, `starterQuantity`). `PillInventoryItem` unchanged — the player inventory DTO never carries the new columns.
- `api.ts`: `fetchAdminPills()`, `createAdminPill(pill)`, `updateAdminPill(id, body)` — all via `apiFetch` (cookies + refresh-retry for free).

### UI — `/admin/pills`

New page in the existing admin shell; `admin/layout.tsx` nav gains a "Đan dược" link beside "Cảnh giới".

- **Flat card list, one card per pill** (not the realms accordion — the catalog is flat and small). Card shows glyph, name, rarity tier (reusing `RARITY_META`), effect kind, headline stat, and an "Đang tắt" badge when `!active`. Clicking a card expands an inline edit form.
- **Per-pill draft state** (differs from the realms page's whole-config draft): each open form has its own "Lưu" / "Hoàn tác"; only the pill with a PUT in flight is disabled. `beforeunload` warns while any form is dirty (consistent with the realms page; in-app nav is not intercepted).
- **Form fields:** id (read-only when editing; editable on create), name, glyph, desc, rarity (select 0–4 with `RARITY_META` labels), effectKind (select of the 4 kinds — switching kinds shows only that kind's stat fields; the others are sent as `null`), starterQuantity, active toggle.
- **Create:** an "Thêm đan dược" button opens the same form component empty; successful POST appends to the list.
- **Client validation:** pure `lib/pill-validation.ts` mirrors the backend's `validatePillDefinition` (per-effectKind rules + id slug `^[a-z0-9-]+$` on create) so errors pin to fields pre-flight; Save disables while errors exist. A failed POST/PUT keeps the draft and surfaces the server message (realms-page pattern).
- **Disable UX:** the active toggle inside the form + Save. No confirm dialog — the action is reversible.

## Error handling summary

| Case | Code | HTTP |
|---|---|---|
| Invalid definition (bad stats for kind, bad rarity, empty name…) | `INVALID_PILL_CONFIG` | 400 |
| Create with existing id | `PILL_ID_TAKEN` | 409 |
| Update unknown id | `PILL_NOT_FOUND` | 404 |
| Player consumes a disabled pill (it is silently *omitted* from `GET /pills/inventory`, not an error there) | `PILL_NOT_FOUND` | 404 |
| Non-admin hits `/admin/pills` | `FORBIDDEN` | 403 |

## Testing

**Backend:**
- Unit: `validatePillDefinition` (each effectKind's happy path + each violation class + boundary values); the three new use cases against `InMemoryPillRepository` (list includes inactive; create validates + duplicate-id 409; update validates + unknown-id 404); `ConsumePillUseCase` inactive-pill guard.
- Integration (real Postgres): non-admin GET/POST/PUT → 403; admin CRUD round-trip (create → list → update → list); disabling a pill removes it from `/pills/inventory` and makes consume return 404 while the `InventoryItem` row survives (re-enable restores it); registration grants inventory per `starterQuantity` (including a 0-quantity pill granting nothing).

**Frontend:**
- Unit: `pill-validation` (mirror rules); api stubs for the three new functions (existing pattern).
- Interactive editor UX (expand/collapse, dirty tracking, disable badge) is the human-observation gate, consistent with prior phases.

**Gate:** backend `npm test` + `tsc` green; frontend `pnpm lint` / `tsc` / `pnpm test` / `pnpm build` green; manual cookie-jar pass against Docker Postgres covering the integration scenarios above.
