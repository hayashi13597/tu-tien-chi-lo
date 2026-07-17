# Đan Dược Backend — Design Spec

Date: 2026-07-18
Scope: Backend only (Node/Express, Clean Architecture). Frontend keeps its mock
(`use-pill-inventory`) for now — wiring the real API is a separate future task.

## Goal

Give the đan dược (alchemy) inventory a real backend: persist each player's pill
inventory, expose it, and let a player consume a pill to apply one of four
effects to their cultivation state. This makes the feature authoritative and
race-safe on the server, so a future frontend task can drop the mock store and
call the API through `api.ts`.

Reference: the frontend mock (`frontend/src/lib/pill-constants.ts`,
`use-pill-inventory.ts`, spec `2026-07-18-dan-duoc-ui-design.md`) defines the
four effect kinds and five rarity tiers this backend must serve.

## Decisions (from planning dialogue)

1. **Timed cultivation buff:** faithful *piecewise integration*. A buff stores a
   multiplier + expiry on the Character; `computeLinhKhi` splits the accrual
   window into a buffed segment and an un-buffed segment. The buffed segment
   accrues at `rate × multiplier`.
2. **Pill definitions live in the DB** (a `Pill` table), not config-in-code — a
   deliberate departure from the `realms.ts` config-in-code pattern, chosen for
   flexibility. Seeded via a Prisma seed script. Player ownership lives in an
   `InventoryItem` table (`userId + pillId + quantity`). New users are seeded a
   starter inventory mirroring the frontend mock.
3. **Scope:** backend only. No frontend wiring in this plan.
4. **breakthroughBoost:** a `breakthroughBonusPct` field on Character. Consuming
   a boost pill sets it; `AttemptBreakthroughUseCase` adds it to the computed
   success rate and resets it to 0 after any attempt resolves (success OR
   failure — the boost is "used" either way).

## Data Model (Prisma)

New models + Character fields:

```prisma
model Pill {
  id          String          @id            // stable slug, e.g. "hoi-khi-dan"
  name        String
  glyph       String
  rarity      Int                             // 0..4
  effectKind  String                          // linhKhi|cultivationBuff|breakthroughBoost|clearPunishment
  amount      Float?                          // linhKhi
  multiplier  Float?                          // cultivationBuff
  durationSec Int?                            // cultivationBuff
  bonusPct    Float?                          // breakthroughBoost
  desc        String
  inventory   InventoryItem[]
}

model InventoryItem {
  id       String @id @default(uuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id])
  pillId   String
  pill     Pill   @relation(fields: [pillId], references: [id])
  quantity Int    @default(0)
  @@unique([userId, pillId])          // one row per (user, pill); quantity aggregates
}

// Added to Character:
//   cultivationBuffMultiplier Float?     // active timed buff multiplier, null when none
//   cultivationBuffUntil      DateTime?  // buff expiry, null when none
//   breakthroughBonusPct      Float   @default(0)  // pending one-shot boost
```

`User` gains `inventory InventoryItem[]`.

## Domain Layer

### `domain/pills/pill.ts` (entity + effect discriminated union)
Pure types: `PillRecord`, `PillEffectKind`, `InventoryItemRecord`. No framework.

### `domain/cultivation/cultivation.calc.ts` (MODIFY)
Extend `computeLinhKhi` to accept an optional active buff and integrate piecewise:

```ts
computeLinhKhi(params: {
  storedLinhKhi; lastUpdateAt; now; cultivationRate;
  offlineCapSeconds?;
  buff?: { multiplier: number; until: Date };  // NEW
}): number
```

Mechanics (commented in code): clamp the elapsed window to `offlineCapSeconds`
first (existing behavior). Within the (capped) window `[lastUpdateAt, now]`, the
buffed portion is `[lastUpdateAt, min(now, until)]` — its seconds accrue at
`rate × multiplier`; the remainder accrues at `rate`. When `buff` is absent or
`until <= lastUpdateAt`, the result is identical to today's formula (backward
compatible — existing tests must still pass unchanged).

### `domain/pills/pill.calc.ts` (NEW, pure)
`applyPillEffect(character, pill, now)` → returns the field changes to persist +
the resulting linhKhi, as a pure function over records. Encapsulates the four
effect branches so both the use case and its tests share one source of truth:
- `linhKhi`: `linhKhi += amount`
- `cultivationBuff`: set `cultivationBuffMultiplier`/`cultivationBuffUntil =
  now + durationSec` (refresh, never stack — one active buff)
- `breakthroughBoost`: set `breakthroughBonusPct = bonusPct` (replace, not add)
- `clearPunishment`: `punishedUntil = null`

### `domain/breakthrough/breakthrough.calc.ts` (MODIFY)
`computeSuccessRate` gains a `bonusPct` term added before the `maxSuccessRate`
clamp — so a boost can push toward, but never past, the cap.

## Ports

### `domain/ports/PillRepository.ts` (NEW)
```ts
interface PillRepository {
  findById(pillId: string): Promise<PillRecord | null>;
  listInventory(userId: string): Promise<Array<{ pill: PillRecord; quantity: number }>>;
  // Atomically decrement one unit, guarded on quantity > 0. Returns false if
  // the user doesn't own the pill / quantity already 0.
  decrementOne(userId: string, pillId: string): Promise<boolean>;
}
```

### `domain/ports/CharacterRepository.ts` (MODIFY)
`CharacterUpdateInput` gains `cultivationBuffMultiplier`, `cultivationBuffUntil`,
`breakthroughBonusPct`. All existing writers set them (carry-through), keeping
the optimistic-concurrency guard intact.

## Application Layer

### `GetInventoryUseCase` (NEW)
`execute(userId)` → `listInventory`, shaped into a DTO array
(`{ pill fields..., quantity }`). Read-only.

### `ConsumePillUseCase` (NEW)
`execute(userId, pillId)`:
1. Load character (throw `CHARACTER_NOT_FOUND` if missing).
2. Load pill (throw `PILL_NOT_FOUND` if missing).
3. Validate effect applicability (throw `PILL_NOT_APPLICABLE`): `clearPunishment`
   when not punished; `linhKhi`/`breakthroughBoost` at max stage.
4. Recompute current linhKhi (with any active buff) up front — same lazy-accrual
   discipline as the breakthrough use case.
5. `pills.decrementOne(...)` — if it returns false, throw `PILL_OUT_OF_STOCK`.
   Decrement BEFORE the character write so a concurrent double-consume can't
   apply the effect twice (the second loses the row-level guard).
6. `applyPillEffect(...)`, persist via `updateWithConcurrencyGuard`
   (throw `CONCURRENT_MODIFICATION` on guard miss).
7. Return the updated cultivation-state-shaped output (reuse the state DTO).

### `AttemptBreakthroughUseCase` (MODIFY)
- Recompute linhKhi with the active buff (piecewise).
- Add `character.breakthroughBonusPct` into `computeSuccessRate`.
- On every resolved attempt (success and failure), persist
  `breakthroughBonusPct = 0`. Rejection paths (max/punished/insufficient) leave
  it untouched (the attempt never actually rolled).

## Presentation Layer

### `presentation/routes/pills.routes.ts` (NEW)
- `GET /pills/inventory` (requireAuth) → `GetInventoryUseCase`
- `POST /pills/consume` (requireAuth), body `{ pillId: string }` validated with
  zod → `ConsumePillUseCase`

### `presentation/middleware/errorHandler.ts` (MODIFY)
Add status mappings: `PILL_NOT_FOUND` 404, `PILL_OUT_OF_STOCK` 409,
`PILL_NOT_APPLICABLE` 400.

### `app.ts` (MODIFY)
Construct `PrismaPillRepository`, the two new use cases, mount `createPillsRouter`.

## Infrastructure

### `infrastructure/repositories/PrismaPillRepository.ts` (NEW)
Implements `PillRepository`. `decrementOne` uses
`updateMany({ where: { userId, pillId, quantity: { gt: 0 } }, data: { quantity: { decrement: 1 } } })`
and checks `count === 1` — a row-level atomic guard, the same discipline as the
character concurrency guard.

### `prisma/seed.ts` (NEW) + starter inventory
Seeds the 8 `Pill` rows (mirroring the frontend catalog). New-user starter
inventory: `RegisterUserUseCase` already creates the Character; extend the
registration flow to also create the starter `InventoryItem` rows. (Design note:
this adds an inventory-seeding responsibility to registration — covered by a
port method `seedStarterInventory(userId)` on `PillRepository` so the use case
stays infrastructure-free.)

## Testing

Follows the existing split: pure unit tests + fakes for use cases, integration
tests against real Postgres for repositories and routes.

- **Unit (pure):** `cultivation.calc` piecewise-buff cases (no buff = unchanged;
  buff fully covers window; buff expires mid-window; buff already expired);
  `breakthrough.calc` bonus term (adds, clamps at max); `pill.calc` four effect
  branches.
- **Unit (use case + fakes):** `ConsumePillUseCase` (each effect, not-applicable
  rejections, out-of-stock, character/pill-not-found, concurrency);
  `GetInventoryUseCase`; `AttemptBreakthroughUseCase` bonus applied + reset on
  success/failure, untouched on rejection. New fake `InMemoryPillRepository`.
- **Integration (Postgres):** `PrismaPillRepository` (listInventory, atomic
  decrementOne including the race), `POST /pills/consume` + `GET /pills/inventory`
  end-to-end, register-seeds-starter-inventory.

### Verification gate
`cd backend && npm test` green; `docker compose up -d --build` then a manual
cookie-jar pass: register → inventory has starter pills → consume each kind →
state reflects effect → consume to 0 → `PILL_OUT_OF_STOCK`.

## File Inventory

New:
- `prisma/seed.ts`
- `src/domain/pills/pill.ts`
- `src/domain/pills/pill.calc.ts`
- `src/domain/ports/PillRepository.ts`
- `src/application/GetInventoryUseCase.ts`
- `src/application/ConsumePillUseCase.ts`
- `src/infrastructure/repositories/PrismaPillRepository.ts`
- `src/presentation/routes/pills.routes.ts`
- `src/presentation/schemas/pills.schemas.ts`
- `tests/fakes/InMemoryPillRepository.ts`
- unit + integration test files listed above

Modified:
- `prisma/schema.prisma` — `Pill`, `InventoryItem`, Character buff/bonus fields, User relation
- `src/domain/cultivation/cultivation.calc.ts` — piecewise buff
- `src/domain/breakthrough/breakthrough.calc.ts` — bonus term
- `src/domain/ports/CharacterRepository.ts` — update input fields
- `src/application/AttemptBreakthroughUseCase.ts` — bonus apply + reset, buffed accrual
- `src/application/RegisterUserUseCase.ts` — seed starter inventory
- `src/infrastructure/repositories/PrismaCharacterRepository.ts` — new fields carry-through
- `src/presentation/middleware/errorHandler.ts` — new codes
- `src/app.ts` — wire pill repo + use cases + router
- `tests/fakes/InMemoryCharacterRepository.ts` — new fields
- `CLAUDE.md` — backend đan dược notes

## Out of Scope (YAGNI)
Frontend wiring, pill crafting/luyện đan, obtaining pills beyond the starter
seed, buff stacking, multiple simultaneous buffs, admin pill CRUD endpoints.
