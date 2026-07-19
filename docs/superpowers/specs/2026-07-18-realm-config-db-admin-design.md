# Realm Config in DB + Admin API — Design

Date: 2026-07-18
Status: Approved (pending implementation plan)

## Problem

Realm/sub-stage tuning data (`linhKhiRequired`, `cultivationRate`, `baseSuccessRate`,
`pityIncrement`, `maxSuccessRate`, `punishmentSeconds`, names) lives hard-coded in
`backend/src/domain/config/realms.ts` as the module constant `REALMS` (12 realms ×
5 sub-stages). Changing any value — for balance tuning — requires a code edit and a
redeploy. We want an admin to change this configuration at runtime, taking effect
immediately, without a deploy.

## Scope

**In scope:** move realm config into the database; expose admin-only REST endpoints
to read and replace it; add an `admin` role for authorization; make config changes
take effect immediately (no restart).

**Out of scope (YAGNI):**
- Admin UI on the frontend (API-only for now; admin edits via curl/Postman).
- Per-field PATCH (replace-all only).
- Config change history / audit log / versioning.
- Changing the frontend's hard-coded `SUB_STAGE_NAMES` — the frontend already renders
  stage names from the backend DTO's `realmName` field, so no frontend change is
  expected. To be re-confirmed against the frontend code during planning.

## Decisions (from brainstorming)

1. **Reach:** DB + Admin API (no UI).
2. **Admin auth:** a `role` column on `User` (`"user"` | `"admin"`), enforced by a
   `requireAdmin` middleware that reuses the existing JWT/cookie auth.
3. **Config load strategy:** a `RealmConfigRepository` port + an in-app cache
   (`RealmConfigProvider`) that exposes config **synchronously** and reloads on write.
4. **PUT scope:** admin may edit the full structure — add/remove realms and sub-stages,
   not just values.
5. **Out-of-range characters:** when a character's `(realmMajor, realmSub)` no longer
   exists in the new config, clamp it to the nearest valid stage on read (this also
   fixes the pre-existing 500 when `realmSub` is outside `0..4`).
6. **Storage shape:** a flat `RealmStage` table, one row per sub-stage.

## Architecture

Clean Architecture is preserved. Dependencies point inward; `domain` stays free of
framework/library imports.

### Data / Schema (migration `realm_config`)

New `RealmStage` table — one row per sub-stage:

```prisma
model RealmStage {
  id                String @id @default(uuid())
  realmMajor        Int      // 0..N realm index
  realmSub          Int      // 0..M sub-stage index within the realm
  realmName         String   // e.g. "Phàm Nhân"
  subStageName      String   // e.g. "Sơ Kỳ"
  linhKhiRequired   Float
  cultivationRate   Float
  baseSuccessRate   Float
  pityIncrement     Float
  maxSuccessRate    Float
  punishmentSeconds Int

  @@unique([realmMajor, realmSub])
}
```

`User` gains:

```prisma
role String @default("user")   // "user" | "admin"
```

**Rationale for a flat table** (mirrors the Phase 4 `Pill` pattern): simple SQL
seeding, one `@@unique` constraint enforces no duplicate coordinates, add/remove =
insert/delete rows. No parent/child join needed; `realmName` repeats per row, which is
acceptable for a small, admin-curated dataset.

### Domain layer

`domain/config/realms.ts`:
- **No longer holds the runtime data as a live constant.** Keeps the pure types
  (`SubStageConfig`, `RealmConfig`) and gains a `RealmConfigSet` value object built
  from rows. `RealmConfigSet` wraps the realms array and exposes pure helpers:
  - `getStage(major, sub): SubStageConfig` — replaces `REALMS[major].subStages[sub]`.
  - `maxRealmMajor: number` — replaces `MAX_REALM_MAJOR`.
  - `peakRealmSub(major): number` — replaces `MAX_REALM_SUB` (now per-realm, since
    realms may have different sub-stage counts).
  - `clampStage(major, sub): { realmMajor, realmSub }` — nearest valid stage. Clamps
    `major` into `[0, maxRealmMajor]`, then `sub` into `[0, peakRealmSub(clampedMajor)]`.
- A **seed snapshot** of the original data stays in this file as a plain literal
  (`SEED_REALMS`) used only by `prisma/seed.ts`. Runtime reads from the DB; the
  snapshot is the seed source of truth and a reference for the original balance.

`domain/cultivation/cultivation.calc.ts` and `domain/breakthrough/breakthrough.calc.ts`
stay pure and keep receiving config via parameters — signatures largely unchanged. The
callers now pass values pulled from a `RealmConfigSet` instead of the old constants.

### Ports / Infrastructure

New port `domain/ports/RealmConfigRepository.ts`:

```ts
interface SubStageRow {
  realmMajor: number; realmSub: number;
  realmName: string; subStageName: string;
  linhKhiRequired: number; cultivationRate: number;
  baseSuccessRate: number; pityIncrement: number;
  maxSuccessRate: number; punishmentSeconds: number;
}

interface RealmConfigRepository {
  loadAll(): Promise<SubStageRow[]>;          // ordered by (realmMajor, realmSub)
  replaceAll(rows: SubStageRow[]): Promise<void>; // atomic full replace
}
```

- `PrismaRealmConfigRepository` (real) and `InMemoryRealmConfigRepository` (test fake),
  mirroring the Pill repository pattern.
- `replaceAll` runs in a single Prisma transaction: `deleteMany()` + `createMany()`, so
  the new config replaces the old atomically — no half-written intermediate state.

New `infrastructure/config/RealmConfigProvider.ts` (in-app cache, wired at the
composition root):
- On boot, calls `loadAll()` once and builds a `RealmConfigSet`.
- Exposes `get(): RealmConfigSet` **synchronously**, so the three use cases keep the
  synchronous access they rely on today (no `await` scattered through domain logic).
- `reload(): Promise<void>` re-reads from the DB and rebuilds the set; called after a
  successful admin PUT so changes take effect immediately.
- No TTL — reload is triggered explicitly on write (config changes are rare; explicit
  invalidation is more precise than polling).

### Application layer

The three existing use cases (`GetCultivationStateUseCase`,
`AttemptBreakthroughUseCase`, `ConsumePillUseCase`) currently
`import { REALMS, MAX_REALM_MAJOR, MAX_REALM_SUB }`. They change to receive a
`RealmConfigSet` (from the provider) and use its helpers:
- `REALMS[major].subStages[sub]` → `config.getStage(major, sub)`
- `MAX_REALM_MAJOR` → `config.maxRealmMajor`
- `MAX_REALM_SUB` → `config.peakRealmSub(major)`

**Lazy clamp on read:** in `GetCultivationStateUseCase`, before `getStage`, call
`config.clampStage(major, sub)`. If it differs from the character's stored stage,
persist the clamped `realmMajor/realmSub` via the character repository using the
existing optimistic-concurrency guard. This turns the current out-of-range 500 into a
self-healing read.

New `UpdateRealmConfigUseCase(realmConfigRepo, provider)`:
1. Validate the submitted config (structural rules — see Validation below). Any
   violation throws `DomainError('INVALID_REALM_CONFIG', ...)`.
2. `realmConfigRepo.replaceAll(rows)`.
3. `provider.reload()` so the new config is live for every subsequent request.
4. Return the saved config.

The use case does **not** proactively clamp characters on PUT — clamping happens lazily
on the read path. Simpler and sufficiently safe.

### Presentation layer

- `TokenService.signAccessToken` also encodes `role`; `verifyAccessToken` returns
  `{ userId, role }`. `requireAuth` attaches `req.role` alongside `req.userId`
  (`AuthedRequest` extended).
- New `requireAdmin` middleware (`presentation/middleware/`): runs **after**
  `requireAuth`; if `req.role !== "admin"` throws `DomainError('FORBIDDEN', ...)`.
- `errorHandler` status map gains: `FORBIDDEN` → 403, `INVALID_REALM_CONFIG` → 400.
- Endpoints (both behind `requireAuth` + `requireAdmin`):
  - `GET /admin/realms` → the current config (read from the provider cache).
  - `PUT /admin/realms` → the full new config (array of realms, each with its
    sub-stages). Zod validates request shape; replace-all semantics.

**Role staleness:** `role` lives in the 15-minute access token. A user just promoted to
admin must re-login (or wait for a refresh) before their token carries `role: "admin"`.
Acceptable for an admin tool; noted here so it is not a surprise.

## Validation rules (PUT /admin/realms)

Enforced by zod (request shape) + `UpdateRealmConfigUseCase` (business invariants):
- At least 1 realm; each realm has at least 1 sub-stage.
- `realmMajor` values are contiguous `0..N`; within each realm `realmSub` is contiguous
  `0..M` (no index gaps — the code addresses stages by contiguous index).
- Numeric sanity: `linhKhiRequired > 0`; `baseSuccessRate`, `maxSuccessRate` in
  `[0, 100]`; `pityIncrement >= 0`; `punishmentSeconds >= 0`; `cultivationRate > 0`.
- `linhKhiRequired` is strictly increasing **within each realm** (Sơ Kỳ → Viên Mãn) — the
  monotonic invariant a realm's progression relies on. It does *not* increase across realm
  boundaries: the balance resets to a lower value at each new realm (e.g. Phàm Nhân peak 500
  → Luyện Khí start 300), so the check is per-realm, not across the flat order.
- Violations → `DomainError('INVALID_REALM_CONFIG', ...)` → HTTP 400.

## Error codes (new)

- `FORBIDDEN` → 403 (non-admin hitting an admin route).
- `INVALID_REALM_CONFIG` → 400 (PUT body fails structural/business validation).

## Seeding & admin bootstrap

- `prisma/seed.ts` extends to upsert all 60 `RealmStage` rows from `SEED_REALMS` (the
  literal snapshot in `realms.ts`), values unchanged from today's balance. Idempotent,
  like the Pill seed.
- The first admin is granted by manual SQL / a seed step (documented in the plan) —
  there is deliberately no self-service "make me admin" endpoint.

## Testing strategy

Follows existing patterns (unit vs. real-Postgres integration).

**Unit (pure, no DB):**
- `RealmConfigSet`: `getStage`, `peakRealmSub`, `maxRealmMajor`, and `clampStage`
  (major over range, sub over range, both over range, in-range no-op).
- `UpdateRealmConfigUseCase` with `InMemoryRealmConfigRepository`: valid config passes;
  each violation (empty realm, index gap, out-of-range %, non-increasing linhKhi)
  yields `INVALID_REALM_CONFIG`.
- The three existing use cases: read config via `RealmConfigSet`; specifically
  `GetCultivationStateUseCase` clamps and persists when the character is out of range.
- `requireAdmin`: missing role / `role: user` → 403; `role: admin` → pass.
  `errorHandler`: `FORBIDDEN` → 403, `INVALID_REALM_CONFIG` → 400.
- `JwtTokenService`: `role` round-trips through the access token.

**Integration (real Postgres):**
- `PrismaRealmConfigRepository.replaceAll` is atomic (delete + create in one
  transaction).
- `GET/PUT /admin/realms` end-to-end: regular user → 403; admin → 200; PUT new config →
  `/cultivation/state` immediately reflects the new values (verifies cache reload).

**Manual verification (cookie jar, Docker Postgres):**
- Promote a user to admin → PUT changes realm 0's `linhKhiRequired` → poll `/cultivation/state`
  shows the new value.
- Regular user PUT → 403.
- PUT a config that removes the last realm → a character in that realm is clamped to a
  valid stage on the next `/cultivation/state` read (no 500).

## Files touched (anticipated)

- `prisma/schema.prisma` — `RealmStage` model, `User.role`.
- `prisma/seed.ts` — seed `RealmStage`.
- `src/domain/config/realms.ts` — `RealmConfigSet`, `SEED_REALMS` snapshot, drop live constants.
- `src/domain/ports/RealmConfigRepository.ts` — new port.
- `src/infrastructure/repositories/PrismaRealmConfigRepository.ts` — new.
- `src/infrastructure/config/RealmConfigProvider.ts` — new cache.
- `src/application/UpdateRealmConfigUseCase.ts` — new.
- `src/application/{GetCultivationState,AttemptBreakthrough,ConsumePill}UseCase.ts` — use `RealmConfigSet`.
- `src/infrastructure/auth/JwtTokenService.ts` + `TokenService` port — encode/return `role`.
- `src/presentation/middleware/requireAdmin.ts` — new; `requireAuth` attaches `role`;
  `errorHandler` new codes.
- `src/presentation/routes` + `src/app.ts` — `/admin/realms` routes, provider wiring.
- Tests + `tests/fakes/InMemoryRealmConfigRepository.ts`, `FakeTokenService` role support.
