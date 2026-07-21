# Redeem Code — Design Spec

Date: 2026-07-21

## Summary

Add a redeem-code feature: an admin creates shareable codes that grant a bundle
of đan dược (pills) to players who enter them. A code is redeemable by many
users but only **once per user**, is capped by a **total redemption count**, and
may optionally **expire**. Players redeem through a modal opened from the header
menu; admins manage codes through a full `/admin/codes` dashboard page.

Scope for v1: **pill rewards only.** Other reward kinds (raw linh khí, buffs,
breakthrough boosts) are explicitly out of scope and deferred.

## Requirements

- A code grants a **bundle** of pills (one or more pill types, each with a
  quantity), so a single code can hand out e.g. 3× pill A + 1× pill B.
- Model: **shared code**, redeemable **once per user**, with a **total
  redemption cap** (`maxRedemptions`) and an **optional expiry** (`expiresAt`,
  null = never).
- Redemption must be **atomic** under concurrency: never exceed the cap, never
  let one user redeem the same code twice, never grant pills on a failed guard.
- Admins get a **full admin UI** to create, edit, soft-disable, and monitor
  codes (usage count vs. cap).
- Players enter codes via a **GSAP modal opened from the header menu** (same
  wiring as the "Đan Phòng" pill modal).

## Architecture

Follows the existing Clean Architecture layering (`domain` → `application` →
`infrastructure`/`presentation`) and reuses the concurrency patterns already
proven in this codebase (optimistic-concurrency / atomic `updateMany` guards,
DB-enforced uniqueness, saga-style compensation — no cross-repo transactions in
the application layer).

### Data model (Prisma migration `redeem_code`)

Three new tables, relational-FK style (no JSON/array columns), consistent with
`Pill`/`InventoryItem`/`RealmStage`.

```prisma
model RedeemCode {
  id              String   @id @default(uuid())
  code            String   @unique          // the string players type, e.g. "TANTHU2026"
  active          Boolean  @default(true)   // soft-disable (same pattern as Pill.active)
  maxRedemptions  Int                        // total cap across all users
  redeemedCount   Int      @default(0)       // atomically incremented on each success
  expiresAt       DateTime?                  // null = never expires
  createdAt       DateTime @default(now())
  rewards         RedeemCodeReward[]
  redemptions     Redemption[]
}

model RedeemCodeReward {
  id       String     @id @default(uuid())
  codeId   String
  code     RedeemCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  pillId   String
  pill     Pill       @relation(fields: [pillId], references: [id])
  quantity Int                                // units of this pill granted
  @@unique([codeId, pillId])                  // one row per pill per code
}

model Redemption {
  id         String     @id @default(uuid())
  codeId     String
  code       RedeemCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  redeemedAt DateTime   @default(now())
  @@unique([codeId, userId])                  // DB-enforced "one redemption per user per code"
}
```

- `Pill` gains a back-relation `redeemRewards RedeemCodeReward[]`.
- `User` gains a back-relation `redemptions Redemption[]`.
- `RedeemCodeReward.pill` FK has **no** cascade (a code cannot reference a
  deleted pill), consistent with `InventoryItem.pill`. `Redemption.user` and
  both `RedeemCode` back-relations cascade on delete (User cascade matches
  `Character`/`InventoryItem`; deleting a `RedeemCode` removes its rewards and
  redemption records).
- No seed data — codes are created at runtime by admins.

### Domain (`domain/redeem/`)

- `redeemCode.ts` — pure types:
  - `RewardEntry` `{ pillId: string; quantity: number }`
  - `RedeemCodeRecord` `{ id, code, active, maxRedemptions, redeemedCount,
    expiresAt: Date | null, rewards: RewardEntry[] }`
  - `RedeemResultDto` `{ rewards: { pillId, name, glyph, quantity }[] }`
    (player-facing granted list).
- `redeemCode.validate.ts` — pure `validateRedeemCodeDefinition`:
  - `code`: non-empty after trim; normalized to uppercase (normalization is the
    single source of truth — both create and lookup uppercase before comparing,
    so codes are case-insensitive to players).
  - `maxRedemptions`: integer `>= 1`.
  - `expiresAt`: if present, a valid `Date` (any point in time; a past date
    simply means the code is already expired — not a validation error).
  - `rewards`: non-empty; each `quantity` integer `>= 1`; no duplicate `pillId`.
  - Violation → `DomainError('INVALID_REDEEM_CODE', ...)`.

### Port (`domain/ports/RedeemCodeRepository.ts`)

Mirrors `PillRepository`'s shape:

- `findByCode(code: string): Promise<RedeemCodeRecord | null>` (caller passes the
  already-normalized/uppercased code).
- `listAll(): Promise<RedeemCodeRecord[]>` — admin, includes inactive.
- `create(record): Promise<void>` — caller guarantees the code is free.
- `update(record): Promise<boolean>` — full-row overwrite by id (rewards
  replaced wholesale via an infra-layer `$transaction([deleteMany, createMany])`
  — same pattern as `PrismaRealmConfigRepository.replaceAll`, not a cross-repo
  transaction in the application layer); returns false on unknown id.
- `tryReserveRedemption(codeId, userId, maxRedemptions): Promise<'ok' |
  'already_redeemed' | 'exhausted'>` — the atomic heart (see Data Flow).
- `grantRewards(userId, rewards: RewardEntry[]): Promise<void>` — upsert each
  pill into the user's inventory (increment-or-create, same logic as
  `seedStarterInventory`).

### Application

- `RedeemCodeUseCase` (player) — see Data Flow for the exact guard order.
- `ListRedeemCodesUseCase` (admin, read-only list).
- `CreateRedeemCodeUseCase` — validate → normalize code → dup-check via
  `findByCode` → `REDEEM_CODE_TAKEN` if present → `create`.
- `UpdateRedeemCodeUseCase` — validate → `update` → `REDEEM_CODE_NOT_FOUND` if
  it returns false. Edits `active`, `expiresAt`, `maxRedemptions`, and the
  rewards bundle. (The `code` string itself is immutable — id/code identity,
  same rationale as immutable pill ids.) `redeemedCount` is system-managed and
  excluded from the update input; setting `maxRedemptions` below the current
  `redeemedCount` is allowed (it makes the code functionally exhausted without
  hard-disabling it — a deliberate admin escape hatch, not a validation error).

### Infrastructure

- `PrismaRedeemCodeRepository` — concrete implementation.
- `InMemoryRedeemCodeRepository` — fake for use-case unit tests (same pattern as
  the pill/user fakes).

### Presentation

- New `presentation/routes/redeem.routes.ts` (player):
  - `POST /redeem` — `requireAuth`, zod `{ code: string }` (trimmed, non-empty).
    `200 { rewards: [{ pillId, name, glyph, quantity }] }`.
- Added to `presentation/routes/admin.routes.ts` (behind `requireAuth +
  requireAdmin`):
  - `GET /admin/codes` → `{ codes }` (full list incl. inactive, with
    `redeemedCount`/`maxRedemptions`/`expiresAt`/rewards).
  - `POST /admin/codes` → 201 (`createRedeemCodeSchema`).
  - `PUT /admin/codes/:id` → 200 (`updateRedeemCodeSchema`; id from URL only,
    immutable — same rule as pills).
- New zod schemas in `presentation/schemas/` (`redeem.schemas.ts` and/or added
  to `admin.schemas.ts`): code slug/format, `maxRedemptions`, nullable
  `expiresAt`, rewards array (`{ pillId, quantity }`).
- `errorHandler.ts` gains the mappings in the Error Handling section.
- `app.ts` constructs the repo + 4 use cases and mounts the redeem router.

## Data Flow — atomic redemption

`RedeemCodeUseCase.execute({ userId, code })`:

1. Normalize `code` (trim + uppercase), `findByCode`.
2. Guard in order (each maps to a `DomainError`):
   - not found → `REDEEM_CODE_NOT_FOUND`
   - `!active` → `REDEEM_CODE_INACTIVE`
   - `expiresAt != null && expiresAt <= now` → `REDEEM_CODE_EXPIRED`
3. `tryReserveRedemption(code.id, userId, code.maxRedemptions)`:
   - Insert the `Redemption` row. A unique-constraint violation on
     `([codeId, userId])` ⇒ return `'already_redeemed'` (no read-then-write
     race — the DB is the arbiter).
   - Otherwise `updateMany({ where: { id: codeId, redeemedCount: { lt:
     maxRedemptions } }, data: { redeemedCount: { increment: 1 } } })`.
     - `count === 0` ⇒ cap already reached: delete the just-inserted
       `Redemption` row (compensation) and return `'exhausted'`.
     - `count === 1` ⇒ return `'ok'`.
   - Map results: `'already_redeemed'` → `REDEEM_CODE_ALREADY_USED`,
     `'exhausted'` → `REDEEM_CODE_EXHAUSTED`.
4. On `'ok'`, `grantRewards(userId, code.rewards)`, then return the
   `RedeemResultDto` (join reward pillIds to pill name/glyph for display).

Reservation happens **before** granting, so a lost cap race never grants pills.
Granting after a successful reservation cannot itself over-grant (the reservation
is the single source of truth for "this user gets the bundle exactly once").

### Disabled-pill rewards

If a code's rewards reference a pill later soft-disabled (`active: false`), the
redemption **grants it anyway** — the admin curated the code and the code's
promise takes precedence over the pill's player-visibility flag. The granted
`InventoryItem` row simply stays hidden from the player's inventory until the
pill is re-enabled (existing `listInventory` filter behavior). Documented so it
is a deliberate choice, not an oversight.

## Error Handling

All errors use the shared `{ error: { code, message } }` shape via
`errorHandler.ts`:

| code | HTTP |
|---|---|
| `REDEEM_CODE_NOT_FOUND` | 404 |
| `REDEEM_CODE_INACTIVE` | 400 |
| `REDEEM_CODE_EXPIRED` | 400 |
| `REDEEM_CODE_ALREADY_USED` | 409 |
| `REDEEM_CODE_EXHAUSTED` | 409 |
| `REDEEM_CODE_TAKEN` | 409 |
| `INVALID_REDEEM_CODE` | 400 |

## Frontend

### Player

- `lib/types.ts`: `RedeemResult` (`{ rewards: { pillId, name, glyph, quantity
  }[] }`).
- `lib/api.ts`: `redeemCode(code)` via `apiFetch` (cookies + single-shot refresh
  retry come free).
- New `components/redeem-modal.tsx` — GSAP modal mirroring `pill-modal.tsx`: code
  input + "Đổi" button with loading/disabled states. Error surfaces the server
  message as a danger toast (404/400/409 all handled). Success fires
  `ParticleCanvas.spawnBurst` + a success toast listing granted pills, and
  triggers a cultivation `refetch()` so any newly granted pill is reflected the
  next time the pill modal opens.
- `HeaderMenu`: new "Nhập Code" item (new `GiftIcon` in `icons.tsx`) in both the
  desktop-inline and mobile-dropdown variants, opening the redeem modal — same
  wiring as the Đan Phòng item.

### Admin

- `lib/types.ts`: `AdminRedeemCodeDTO` (id, code, active, maxRedemptions,
  redeemedCount, expiresAt, rewards).
- `lib/api.ts`: `fetchAdminCodes` / `createAdminCode` / `updateAdminCode`.
- Pure `lib/redeem-validation.ts` mirroring the backend zod ranges (code format,
  `maxRedemptions >= 1`, rewards non-empty, `quantity >= 1`, no duplicate pill)
  so field errors pin pre-flight and Save disables while errors exist. NaN from
  empty numeric inputs blocks Save (same pattern as the pill/realm editors).
- New `/admin/codes` page in the pro-dashboard register, master/detail like
  `/admin/pills`:
  - Left `.admin-*-list`: one row per code — code string, active status dot,
    `redeemedCount/maxRedemptions`, expiry.
  - Right detail: per-code draft form with its own Lưu/Hoàn tác (per-code PUT),
    `beforeunload` warns while dirty. Rewards editor = add/remove reward rows,
    each a pill dropdown (from `fetchAdminPills`) + a quantity input.
  - Create flow for a brand-new code (POST).
- Nav link "Redeem Code" (new icon) in `admin/layout.tsx`.

## Testing

Follows the empirical-verification norm for this repo (unit + integration vs.
real Postgres, plus a manual cookie-jar pass; animated components are a
human-observation gate).

### Backend

- `redeemCode.validate.ts` unit tests (each invariant: bad code, `maxRedemptions
  < 1`, empty rewards, `quantity < 1`, duplicate pillId).
- `RedeemCodeUseCase` unit tests vs. `InMemoryRedeemCodeRepository`: success
  (grants correct bundle), not-found, inactive, expired, already-used, exhausted.
- Admin use-case unit tests: create (dup → `REDEEM_CODE_TAKEN`), update (unknown
  id → `REDEEM_CODE_NOT_FOUND`), list.
- `PrismaRedeemCodeRepository` integration tests, **including the atomic
  reserve**: two concurrent redemptions of a `maxRedemptions: 1` code by
  different users yield exactly one `'ok'` and one `'exhausted'` (pre-warm the
  connection pool like the existing breakthrough race test); a user redeeming
  the same code twice gets `'already_redeemed'` the second time.
- `redeem.routes` + `admin.codes` integration tests (HTTP status per the error
  table; successful redeem grants inventory).
- `errorHandler` mappings for the new codes.

### Frontend

- `lib/redeem-validation.ts` pure unit tests.
- `lib/api.ts` `redeemCode` stub test (fetch mocked — success + error shapes),
  matching the existing pill-api stub-test style.
- Admin redeem-code api stub tests.
- No component snapshots; modal/animation parity is a human-observation gate.

### Manual verification (cookie jar vs. Docker Postgres)

Admin creates a code (bundle of 2 pills, `maxRedemptions: 2`, no expiry) →
player A redeems (inventory gains both pills, `redeemedCount` 0→1) → player A
redeems again → 409 `REDEEM_CODE_ALREADY_USED` → player B redeems
(`redeemedCount` 1→2) → player C redeems → 409 `REDEEM_CODE_EXHAUSTED` →
admin disables the code → fresh player redeem → 400 `REDEEM_CODE_INACTIVE` →
expired-code and unknown-code paths → non-admin `GET /admin/codes` → 403.
Verification rows removed afterward.

## Deferred / out of scope

- Non-pill reward kinds (raw linh khí, cultivation buff, breakthrough boost).
- Rate limiting on `POST /redeem` (authenticated + per-user-once already bounds
  abuse; can add the existing limiter pattern later if needed).
- Per-code analytics beyond `redeemedCount` (e.g. redemption timeline/export).
- Bulk one-time-use gift-card style codes (this design is shared-code only).
