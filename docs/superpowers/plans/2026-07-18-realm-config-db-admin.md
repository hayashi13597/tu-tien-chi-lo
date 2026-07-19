# Realm Config in DB + Admin API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the hard-coded realm/sub-stage tuning data into the database and add admin-only REST endpoints to read and replace it, so an admin can retune the game at runtime with no redeploy.

**Architecture:** A flat `RealmStage` table holds the config (seeded from today's values). A domain `RealmConfigSet` value object wraps the config with pure helpers (`getStage`, `maxRealmMajor`, `peakRealmSub`, `clampStage`); the three cultivation use cases receive it through a `RealmConfigSource` port instead of importing a module constant. An infrastructure `RealmConfigProvider` loads the config once at boot, serves it synchronously, and reloads after an admin write. Admin auth is a `role` column on `User` carried in the access token and enforced by a `requireAdmin` middleware.

**Tech Stack:** Node/Express, TypeScript, Prisma + PostgreSQL, jsonwebtoken, zod, Vitest, supertest.

## Global Constraints

- **Clean Architecture, dependencies inward only.** `domain/` has zero framework/library imports and defines ports; `application/` depends only on domain ports; `infrastructure/` implements ports; `presentation/` maps HTTP ↔ use cases. `domain` must never import from `infrastructure`/`presentation`.
- **Comment non-trivial logic** (formulas, state transitions, concurrency, clamping) explaining the *why*.
- **Use context7 (`ctx7` CLI) before writing library-specific code** (Prisma, Express, zod, jsonwebtoken) and cross-check against the version pinned in `backend/package.json`.
- **Update `CLAUDE.md` after each task** to reflect new architecture/commands/notes.
- **Copy/attribution:** describe reused data (e.g. the seed snapshot) as intentional reuse, never "copying". Commit messages in this repo omit any Claude co-author trailer.
- All backend commands run from `backend/`. Tests: `npm test`. Migration: `npx prisma migrate dev --name <name>`. Seed: `npm run db:seed`. Integration tests need Postgres up (`docker compose up -d --build`).

## File Structure

**Domain**
- `src/domain/config/realms.ts` — MODIFY. Keep `SubStageConfig`/`RealmConfig` types. Add `SubStageRow`, `RealmConfigSet` class, `realmConfigSetFromRows`, `flattenRealms`, `SEED_REALMS` (nested literal snapshot of today's data), `defaultRealmConfigSet()`. Remove the live `REALMS`/`MAX_REALM_MAJOR`/`MAX_REALM_SUB` exports.
- `src/domain/ports/RealmConfigSource.ts` — CREATE. `{ get(): RealmConfigSet }`.
- `src/domain/ports/RealmConfigRepository.ts` — CREATE. `{ loadAll(): Promise<SubStageRow[]>; replaceAll(rows): Promise<void> }`.
- `src/domain/entities/User.ts` — MODIFY. Add `role: string`.

**Application**
- `src/application/GetCultivationStateUseCase.ts` / `AttemptBreakthroughUseCase.ts` / `ConsumePillUseCase.ts` — MODIFY. Take a `RealmConfigSource`; use its helpers. `GetCultivationStateUseCase` also lazy-clamps.
- `src/application/UpdateRealmConfigUseCase.ts` — CREATE.
- `src/application/RefreshAccessTokenUseCase.ts` — MODIFY. Look up the user's current `role` to mint the new access token with it.
- `src/application/LoginUserUseCase.ts` / `RegisterUserUseCase.ts` — MODIFY. Pass `role` when signing the access token.

**Infrastructure**
- `src/infrastructure/repositories/PrismaRealmConfigRepository.ts` — CREATE.
- `src/infrastructure/config/RealmConfigProvider.ts` — CREATE.
- `src/infrastructure/repositories/PrismaUserRepository.ts` — MODIFY. `findById`; return `role`.
- `src/infrastructure/auth/JwtTokenService.ts` — MODIFY. Encode/return `role`.

**Ports touched**
- `src/domain/ports/TokenService.ts` — MODIFY. `signAccessToken(userId, role)`, `verifyAccessToken → { userId, role }`.
- `src/domain/ports/UserRepository.ts` — MODIFY. Add `findById(id)`.

**Presentation**
- `src/presentation/middleware/auth.ts` — MODIFY. Attach `req.role`.
- `src/presentation/middleware/requireAdmin.ts` — CREATE.
- `src/presentation/middleware/errorHandler.ts` — MODIFY. `FORBIDDEN` 403, `INVALID_REALM_CONFIG` 400.
- `src/presentation/schemas/admin.schemas.ts` — CREATE. Zod for PUT body.
- `src/presentation/routes/admin.routes.ts` — CREATE. `GET`/`PUT /admin/realms`.
- `src/app.ts` — MODIFY. Build repo+provider, ensure-loaded middleware, thread the source into use cases, mount admin router, wire refresh with UserRepository.

**Prisma**
- `prisma/schema.prisma` — MODIFY. `RealmStage` model, `User.role`.
- `prisma/seed.ts` — MODIFY. Seed `RealmStage` from `SEED_REALMS`.

**Test fakes**
- `tests/fakes/StaticRealmConfigSource.ts` — CREATE.
- `tests/fakes/InMemoryRealmConfigRepository.ts` — CREATE.
- `tests/fakes/FakeTokenService.ts` — MODIFY. Role round-trip.
- `tests/fakes/InMemoryUserRepository.ts` — MODIFY. `role`, `findById`, admin seed helper.

---

## Task 1: Domain `RealmConfigSet` + config source (pure, no DB)

Refactor `realms.ts` so the config is a value object served through a port, and migrate the three cultivation use cases to it. Data is unchanged (`SEED_REALMS` holds today's exact values), so all existing behavior/tests stay green.

**Files:**
- Modify: `backend/src/domain/config/realms.ts`
- Create: `backend/src/domain/ports/RealmConfigSource.ts`
- Create: `backend/tests/fakes/StaticRealmConfigSource.ts`
- Modify: `backend/src/application/GetCultivationStateUseCase.ts`, `AttemptBreakthroughUseCase.ts`, `ConsumePillUseCase.ts`
- Test: `backend/tests/unit/RealmConfigSet.test.ts` (create), plus edits to the three use-case tests.

**Interfaces:**
- Produces:
  - `interface SubStageRow { realmMajor: number; realmSub: number; realmName: string; subStageName: string; linhKhiRequired: number; cultivationRate: number; baseSuccessRate: number; pityIncrement: number; maxSuccessRate: number; punishmentSeconds: number; }`
  - `class RealmConfigSet` with `getStage(major, sub): SubStageConfig`, `realmName(major): string`, `get maxRealmMajor(): number`, `peakRealmSub(major): number`, `clampStage(major, sub): { realmMajor: number; realmSub: number }`, `toRealms(): RealmConfig[]`.
  - `realmConfigSetFromRows(rows: SubStageRow[]): RealmConfigSet`
  - `flattenRealms(realms: RealmConfig[]): SubStageRow[]`
  - `defaultRealmConfigSet(): RealmConfigSet`
  - `SEED_REALMS: RealmConfig[]`
  - `interface RealmConfigSource { get(): RealmConfigSet }`
- Consumes (by use cases): `RealmConfigSource`.

- [ ] **Step 1: Write the failing test** — `backend/tests/unit/RealmConfigSet.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  realmConfigSetFromRows,
  flattenRealms,
  defaultRealmConfigSet,
  SEED_REALMS,
  SubStageRow,
} from '../../src/domain/config/realms';

const ROWS: SubStageRow[] = [
  { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
  { realmMajor: 0, realmSub: 1, realmName: 'A', subStageName: 'A1', linhKhiRequired: 200, cultivationRate: 1.2, baseSuccessRate: 88, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 400 },
  { realmMajor: 1, realmSub: 0, realmName: 'B', subStageName: 'B0', linhKhiRequired: 300, cultivationRate: 1.5, baseSuccessRate: 84, pityIncrement: 9, maxSuccessRate: 95, punishmentSeconds: 500 },
];

describe('RealmConfigSet', () => {
  it('builds nested realms from flat rows and reads a stage', () => {
    const set = realmConfigSetFromRows(ROWS);
    expect(set.maxRealmMajor).toBe(1);
    expect(set.peakRealmSub(0)).toBe(1);
    expect(set.peakRealmSub(1)).toBe(0);
    expect(set.realmName(1)).toBe('B');
    expect(set.getStage(0, 1).name).toBe('A1');
    expect(set.getStage(0, 1).linhKhiRequired).toBe(200);
  });

  it('clampStage clamps an over-range major then sub to the nearest valid stage', () => {
    const set = realmConfigSetFromRows(ROWS);
    expect(set.clampStage(0, 0)).toEqual({ realmMajor: 0, realmSub: 0 }); // in range, no-op
    expect(set.clampStage(0, 9)).toEqual({ realmMajor: 0, realmSub: 1 }); // sub over range
    expect(set.clampStage(5, 3)).toEqual({ realmMajor: 1, realmSub: 0 }); // major over range → clamp sub to that realm's peak
    expect(set.clampStage(-2, -5)).toEqual({ realmMajor: 0, realmSub: 0 }); // below range
  });

  it('flattenRealms is the inverse of realmConfigSetFromRows for realm/sub indices', () => {
    const rows = flattenRealms(realmConfigSetFromRows(ROWS).toRealms());
    expect(rows.map((r) => [r.realmMajor, r.realmSub, r.subStageName])).toEqual([
      [0, 0, 'A0'], [0, 1, 'A1'], [1, 0, 'B0'],
    ]);
  });

  it('defaultRealmConfigSet exposes 12 realms of 5 sub-stages from SEED_REALMS', () => {
    const set = defaultRealmConfigSet();
    expect(SEED_REALMS.length).toBe(12);
    expect(set.maxRealmMajor).toBe(11);
    expect(set.peakRealmSub(0)).toBe(4);
    expect(set.getStage(0, 0).linhKhiRequired).toBe(100); // unchanged from today's balance
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/RealmConfigSet.test.ts`
Expected: FAIL (`realmConfigSetFromRows` / `RealmConfigSet` not exported).

- [ ] **Step 3: Rewrite `realms.ts`**

Replace the top of the file (the `interface`s and the `export const REALMS`/`MAX_*` block) so the **data stays byte-for-byte identical** but lives under `SEED_REALMS`, and add the value object. Keep every realm/sub-stage literal exactly as it is today — only rename `export const REALMS: RealmConfig[] =` to `export const SEED_REALMS: RealmConfig[] =`, widen the tuple type to an array, and append the helpers below. Delete the old `MAX_REALM_MAJOR` / `MAX_REALM_SUB` exports.

```typescript
export interface SubStageConfig {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

export interface RealmConfig {
  name: string;
  // One or more sub-stages, ordered Sơ Kỳ → … → Viên Mãn. The count is no longer
  // fixed at 5: admins may add/remove sub-stages, so consumers must read the
  // length via RealmConfigSet.peakRealmSub instead of assuming an index.
  subStages: SubStageConfig[];
}

// Flat DB-row shape: one row per sub-stage, the storage form of the config.
export interface SubStageRow {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  subStageName: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

// SEED_REALMS is the original hard-coded balance, kept only as the seed source
// of truth and a reference. Runtime reads the config from the DB (RealmStage);
// this literal is upserted by prisma/seed.ts. --- KEEP THE 12×5 DATA UNCHANGED ---
export const SEED_REALMS: RealmConfig[] = [
  /* ...the existing 12 realms, verbatim, renamed from REALMS... */
];

// Immutable view over the realm config with the pure helpers the use cases need.
// Replaces the old REALMS[..] indexing + MAX_REALM_* constants so the sub-stage
// count and realm count come from the data, not magic numbers.
export class RealmConfigSet {
  constructor(private readonly realms: RealmConfig[]) {}

  getStage(realmMajor: number, realmSub: number): SubStageConfig {
    return this.realms[realmMajor].subStages[realmSub];
  }

  realmName(realmMajor: number): string {
    return this.realms[realmMajor].name;
  }

  get maxRealmMajor(): number {
    return this.realms.length - 1;
  }

  peakRealmSub(realmMajor: number): number {
    return this.realms[realmMajor].subStages.length - 1;
  }

  // Nearest valid (major, sub) for a possibly out-of-range character — e.g. after
  // an admin removes a realm/sub-stage under someone standing on it. Clamp major
  // into [0, maxRealmMajor] first, then sub into [0, peakRealmSub(clampedMajor)],
  // because the valid sub range depends on which realm we landed in.
  clampStage(realmMajor: number, realmSub: number): { realmMajor: number; realmSub: number } {
    const major = Math.min(Math.max(realmMajor, 0), this.maxRealmMajor);
    const sub = Math.min(Math.max(realmSub, 0), this.peakRealmSub(major));
    return { realmMajor: major, realmSub: sub };
  }

  toRealms(): RealmConfig[] {
    return this.realms;
  }
}

// Group ordered flat rows back into the nested realm structure.
export function realmConfigSetFromRows(rows: SubStageRow[]): RealmConfigSet {
  const sorted = [...rows].sort((a, b) =>
    a.realmMajor - b.realmMajor || a.realmSub - b.realmSub,
  );
  const realms: RealmConfig[] = [];
  for (const r of sorted) {
    if (!realms[r.realmMajor]) {
      realms[r.realmMajor] = { name: r.realmName, subStages: [] };
    }
    realms[r.realmMajor].subStages[r.realmSub] = {
      name: r.subStageName,
      linhKhiRequired: r.linhKhiRequired,
      cultivationRate: r.cultivationRate,
      baseSuccessRate: r.baseSuccessRate,
      pityIncrement: r.pityIncrement,
      maxSuccessRate: r.maxSuccessRate,
      punishmentSeconds: r.punishmentSeconds,
    };
  }
  return new RealmConfigSet(realms);
}

// Nested → flat rows, assigning realmMajor/realmSub from array positions.
export function flattenRealms(realms: RealmConfig[]): SubStageRow[] {
  const rows: SubStageRow[] = [];
  realms.forEach((realm, realmMajor) => {
    realm.subStages.forEach((s, realmSub) => {
      rows.push({
        realmMajor,
        realmSub,
        realmName: realm.name,
        subStageName: s.name,
        linhKhiRequired: s.linhKhiRequired,
        cultivationRate: s.cultivationRate,
        baseSuccessRate: s.baseSuccessRate,
        pityIncrement: s.pityIncrement,
        maxSuccessRate: s.maxSuccessRate,
        punishmentSeconds: s.punishmentSeconds,
      });
    });
  });
  return rows;
}

export function defaultRealmConfigSet(): RealmConfigSet {
  return new RealmConfigSet(SEED_REALMS);
}
```

- [ ] **Step 4: Create the port** — `backend/src/domain/ports/RealmConfigSource.ts`

```typescript
import { RealmConfigSet } from '../config/realms';

// A synchronous accessor for the current realm config. The infrastructure
// provider caches the DB-loaded set and returns it here so use cases keep the
// synchronous access they had with the old module constant.
export interface RealmConfigSource {
  get(): RealmConfigSet;
}
```

- [ ] **Step 5: Create the test fake** — `backend/tests/fakes/StaticRealmConfigSource.ts`

```typescript
import { RealmConfigSource } from '../../src/domain/ports/RealmConfigSource';
import { RealmConfigSet, defaultRealmConfigSet } from '../../src/domain/config/realms';

export class StaticRealmConfigSource implements RealmConfigSource {
  constructor(private readonly set: RealmConfigSet = defaultRealmConfigSet()) {}
  get(): RealmConfigSet {
    return this.set;
  }
}
```

- [ ] **Step 6: Migrate `GetCultivationStateUseCase.ts`**

Change the import line 3 and the constructor, and replace the config reads. Replace line 3:

```typescript
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';
```

Constructor:

```typescript
  constructor(
    private readonly characters: CharacterRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}
```

Inside `execute`, after loading `character`, add `const config = this.realmConfig.get();` and replace:
- `const stage = REALMS[character.realmMajor].subStages[character.realmSub];` → `const stage = config.getStage(character.realmMajor, character.realmSub);`
- `isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR, MAX_REALM_SUB)` → `isMaxStage(character.realmMajor, character.realmSub, config.maxRealmMajor, config.peakRealmSub(character.realmMajor))`
- `` `${REALMS[character.realmMajor].name} - ${stage.name}` `` → `` `${config.realmName(character.realmMajor)} - ${stage.name}` ``

(Lazy clamping is added in Task 4 — not here.)

- [ ] **Step 7: Migrate `AttemptBreakthroughUseCase.ts`**

Replace line 4 import with `import { RealmConfigSource } from '../domain/ports/RealmConfigSource';`. Constructor:

```typescript
  constructor(
    private readonly characters: CharacterRepository,
    private readonly randomSource: RandomSource,
    private readonly realmConfig: RealmConfigSource,
  ) {}
```

In `execute`, add `const config = this.realmConfig.get();` before reading the stage, then replace:
- `REALMS[character.realmMajor].subStages[character.realmSub]` → `config.getStage(character.realmMajor, character.realmSub)`
- `isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR, MAX_REALM_SUB)` → `isMaxStage(character.realmMajor, character.realmSub, config.maxRealmMajor, config.peakRealmSub(character.realmMajor))`
- `nextStage(character.realmMajor, character.realmSub, MAX_REALM_SUB)` → `nextStage(character.realmMajor, character.realmSub, config.peakRealmSub(character.realmMajor))`

- [ ] **Step 8: Migrate `ConsumePillUseCase.ts`**

Replace line 4 import with `import { RealmConfigSource } from '../domain/ports/RealmConfigSource';`. Constructor:

```typescript
  constructor(
    private readonly characters: CharacterRepository,
    private readonly pills: PillRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}
```

In `execute`, add `const config = this.realmConfig.get();` before reading the stage, then replace:
- `REALMS[character.realmMajor].subStages[character.realmSub]` → `config.getStage(character.realmMajor, character.realmSub)`
- both `isMaxStage(..., MAX_REALM_MAJOR, MAX_REALM_SUB)` calls → `isMaxStage(..., config.maxRealmMajor, config.peakRealmSub(<thatMajor>))` (use `character.realmMajor` for the first, `updated.realmMajor` for the second)
- `REALMS[updated.realmMajor].subStages[updated.realmSub]` → `config.getStage(updated.realmMajor, updated.realmSub)`
- `` `${REALMS[updated.realmMajor].name} - ${newStage.name}` `` → `` `${config.realmName(updated.realmMajor)} - ${newStage.name}` ``

- [ ] **Step 9: Update the three use-case unit tests to pass the source**

In each file add the import and pass a `new StaticRealmConfigSource()` as the new constructor arg:

`tests/unit/GetCultivationStateUseCase.test.ts` — add `import { StaticRealmConfigSource } from '../fakes/StaticRealmConfigSource';`, and change each `new GetCultivationStateUseCase(<chars>)` to `new GetCultivationStateUseCase(<chars>, new StaticRealmConfigSource())` (lines 26, 33, 48, 57, 66, 81).

`tests/unit/AttemptBreakthroughUseCase.test.ts` — add the same import; change each `new AttemptBreakthroughUseCase(<chars>, <random>)` to `new AttemptBreakthroughUseCase(<chars>, <random>, new StaticRealmConfigSource())` (all occurrences).

`tests/unit/ConsumePillUseCase.test.ts` — add the same import; change the helper `new ConsumePillUseCase(characters, pills)` (line 22) to `new ConsumePillUseCase(characters, pills, new StaticRealmConfigSource())`.

- [ ] **Step 10: Run the affected unit tests**

Run: `cd backend && npx vitest run tests/unit/RealmConfigSet.test.ts tests/unit/GetCultivationStateUseCase.test.ts tests/unit/AttemptBreakthroughUseCase.test.ts tests/unit/ConsumePillUseCase.test.ts`
Expected: PASS (data unchanged, so the character-seed math still holds).

- [ ] **Step 11: Typecheck the app (integration tests + app.ts still reference the old constructors — expected to fail here)**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -30`
Expected: errors only in `src/app.ts` (use-case constructors now need a source). These are fixed in Task 3. Do not fix app.ts yet.

- [ ] **Step 12: Commit**

```bash
cd backend && git add src/domain/config/realms.ts src/domain/ports/RealmConfigSource.ts \
  src/application/GetCultivationStateUseCase.ts src/application/AttemptBreakthroughUseCase.ts \
  src/application/ConsumePillUseCase.ts tests/fakes/StaticRealmConfigSource.ts \
  tests/unit/RealmConfigSet.test.ts tests/unit/GetCultivationStateUseCase.test.ts \
  tests/unit/AttemptBreakthroughUseCase.test.ts tests/unit/ConsumePillUseCase.test.ts
git commit -m "refactor(backend): serve realm config via RealmConfigSet + source port"
```

---

## Task 2: `RealmStage` table, migration, seed, and repository

Add the DB table, seed it from `SEED_REALMS`, and implement the config repository (Prisma + fake).

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/src/domain/ports/RealmConfigRepository.ts`
- Create: `backend/src/infrastructure/repositories/PrismaRealmConfigRepository.ts`
- Create: `backend/tests/fakes/InMemoryRealmConfigRepository.ts`
- Test: `backend/tests/integration/PrismaRealmConfigRepository.test.ts` (create)

**Interfaces:**
- Consumes: `SubStageRow`, `flattenRealms`, `SEED_REALMS` (Task 1).
- Produces: `interface RealmConfigRepository { loadAll(): Promise<SubStageRow[]>; replaceAll(rows: SubStageRow[]): Promise<void>; }`; `class PrismaRealmConfigRepository`; `class InMemoryRealmConfigRepository`.

- [ ] **Step 1: Add the Prisma model + `User.role`** — `backend/prisma/schema.prisma`

Add to the `User` model (below `passwordHash`):

```prisma
  role         String     @default("user") // "user" | "admin"
```

Add a new model at the end:

```prisma
model RealmStage {
  id                String @id @default(uuid())
  realmMajor        Int
  realmSub          Int
  realmName         String
  subStageName      String
  linhKhiRequired   Float
  cultivationRate   Float
  baseSuccessRate   Float
  pityIncrement     Float
  maxSuccessRate    Float
  punishmentSeconds Int

  @@unique([realmMajor, realmSub])
}
```

- [ ] **Step 2: Generate the migration**

Run: `cd backend && npx prisma migrate dev --name realm_config`
Expected: creates `prisma/migrations/<ts>_realm_config/`, applies it, regenerates the client. (Requires the `db` service up.)

- [ ] **Step 3: Create the port** — `backend/src/domain/ports/RealmConfigRepository.ts`

```typescript
import { SubStageRow } from '../config/realms';

export interface RealmConfigRepository {
  // All sub-stage rows, ordered by (realmMajor, realmSub).
  loadAll(): Promise<SubStageRow[]>;
  // Replace the entire config atomically (delete-all + insert-all in one
  // transaction), so a partial write can never leave a half-applied config.
  replaceAll(rows: SubStageRow[]): Promise<void>;
}
```

- [ ] **Step 4: Write the failing integration test** — `backend/tests/integration/PrismaRealmConfigRepository.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaRealmConfigRepository } from '../../src/infrastructure/repositories/PrismaRealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

const repo = new PrismaRealmConfigRepository(prisma);

const rows: SubStageRow[] = [
  { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
  { realmMajor: 0, realmSub: 1, realmName: 'A', subStageName: 'A1', linhKhiRequired: 200, cultivationRate: 1.2, baseSuccessRate: 88, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 400 },
];

beforeEach(async () => {
  await prisma.realmStage.deleteMany();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaRealmConfigRepository', () => {
  it('replaceAll then loadAll round-trips ordered rows', async () => {
    await repo.replaceAll(rows);
    const loaded = await repo.loadAll();
    expect(loaded.map((r) => r.subStageName)).toEqual(['A0', 'A1']);
    expect(loaded[1].linhKhiRequired).toBe(200);
  });

  it('replaceAll fully replaces the previous config (no leftover rows)', async () => {
    await repo.replaceAll(rows);
    await repo.replaceAll([
      { realmMajor: 0, realmSub: 0, realmName: 'B', subStageName: 'B0', linhKhiRequired: 500, cultivationRate: 2, baseSuccessRate: 80, pityIncrement: 8, maxSuccessRate: 95, punishmentSeconds: 600 },
    ]);
    const loaded = await repo.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].realmName).toBe('B');
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/integration/PrismaRealmConfigRepository.test.ts`
Expected: FAIL (`PrismaRealmConfigRepository` not found).

- [ ] **Step 6: Implement `PrismaRealmConfigRepository`** — `backend/src/infrastructure/repositories/PrismaRealmConfigRepository.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { RealmConfigRepository } from '../../domain/ports/RealmConfigRepository';
import { SubStageRow } from '../../domain/config/realms';

export class PrismaRealmConfigRepository implements RealmConfigRepository {
  constructor(private readonly client: PrismaClient) {}

  async loadAll(): Promise<SubStageRow[]> {
    const rows = await this.client.realmStage.findMany({
      orderBy: [{ realmMajor: 'asc' }, { realmSub: 'asc' }],
    });
    // Drop the surrogate `id`; the domain row is keyed by (realmMajor, realmSub).
    return rows.map(({ id: _id, ...rest }) => rest);
  }

  async replaceAll(rows: SubStageRow[]): Promise<void> {
    // Single transaction: wipe then re-insert. An admin's new config replaces the
    // old one atomically — a reader can never observe a partially-written config.
    await this.client.$transaction([
      this.client.realmStage.deleteMany(),
      this.client.realmStage.createMany({ data: rows }),
    ]);
  }
}
```

- [ ] **Step 7: Run the integration test to verify it passes**

Run: `cd backend && npx vitest run tests/integration/PrismaRealmConfigRepository.test.ts`
Expected: PASS.

- [ ] **Step 8: Create the in-memory fake** — `backend/tests/fakes/InMemoryRealmConfigRepository.ts`

```typescript
import { RealmConfigRepository } from '../../src/domain/ports/RealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

export class InMemoryRealmConfigRepository implements RealmConfigRepository {
  private rows: SubStageRow[];
  constructor(initial: SubStageRow[] = []) {
    this.rows = [...initial];
  }
  async loadAll(): Promise<SubStageRow[]> {
    return [...this.rows].sort((a, b) => a.realmMajor - b.realmMajor || a.realmSub - b.realmSub);
  }
  async replaceAll(rows: SubStageRow[]): Promise<void> {
    this.rows = [...rows];
  }
}
```

- [ ] **Step 9: Seed `RealmStage`** — `backend/prisma/seed.ts`

At the top add:

```typescript
import { SEED_REALMS, flattenRealms } from '../src/domain/config/realms';
```

Inside `main()`, after the pill upsert loop, add:

```typescript
  // Seed the realm config from the original hard-coded balance. Idempotent:
  // upsert by the (realmMajor, realmSub) unique key so re-running updates values
  // in place instead of duplicating rows.
  for (const row of flattenRealms(SEED_REALMS)) {
    await prisma.realmStage.upsert({
      where: { realmMajor_realmSub: { realmMajor: row.realmMajor, realmSub: row.realmSub } },
      create: row,
      update: row,
    });
  }
```

- [ ] **Step 10: Run the seed and verify row count**

Run: `cd backend && npm run db:seed && npx prisma db execute --stdin <<< 'SELECT count(*) FROM "RealmStage";'`
Expected: seed completes; count is 60.

- [ ] **Step 11: Commit**

```bash
cd backend && git add prisma/schema.prisma prisma/migrations prisma/seed.ts \
  src/domain/ports/RealmConfigRepository.ts \
  src/infrastructure/repositories/PrismaRealmConfigRepository.ts \
  tests/fakes/InMemoryRealmConfigRepository.ts \
  tests/integration/PrismaRealmConfigRepository.test.ts
git commit -m "feat(backend): add RealmStage table, migration, seed, and config repository"
```

---

## Task 3: `RealmConfigProvider` + wire config into the app

Add the boot-time cache that serves the config synchronously and reloads on demand, and fix `app.ts` to build it and thread the source into the three use cases.

**Files:**
- Create: `backend/src/infrastructure/config/RealmConfigProvider.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/RealmConfigProvider.test.ts` (create); reuse `tests/integration/cultivation.state.test.ts` for the end-to-end check.

**Interfaces:**
- Consumes: `RealmConfigRepository`, `realmConfigSetFromRows`, `RealmConfigSource`.
- Produces: `class RealmConfigProvider implements RealmConfigSource` with `ensureLoaded(): Promise<void>`, `reload(): Promise<void>`, `get(): RealmConfigSet`.

- [ ] **Step 1: Write the failing test** — `backend/tests/unit/RealmConfigProvider.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { RealmConfigProvider } from '../../src/infrastructure/config/RealmConfigProvider';
import { InMemoryRealmConfigRepository } from '../fakes/InMemoryRealmConfigRepository';
import { SubStageRow } from '../../src/domain/config/realms';

const rowA: SubStageRow = { realmMajor: 0, realmSub: 0, realmName: 'A', subStageName: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 };
const rowB: SubStageRow = { ...rowA, realmName: 'B', subStageName: 'B0', linhKhiRequired: 999 };

describe('RealmConfigProvider', () => {
  it('get() throws before ensureLoaded()', () => {
    const provider = new RealmConfigProvider(new InMemoryRealmConfigRepository([rowA]));
    expect(() => provider.get()).toThrow();
  });

  it('serves the loaded config synchronously after ensureLoaded()', async () => {
    const provider = new RealmConfigProvider(new InMemoryRealmConfigRepository([rowA]));
    await provider.ensureLoaded();
    expect(provider.get().getStage(0, 0).linhKhiRequired).toBe(100);
  });

  it('reload() picks up a changed config', async () => {
    const repo = new InMemoryRealmConfigRepository([rowA]);
    const provider = new RealmConfigProvider(repo);
    await provider.ensureLoaded();
    await repo.replaceAll([rowB]);
    await provider.reload();
    expect(provider.get().getStage(0, 0).linhKhiRequired).toBe(999);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/unit/RealmConfigProvider.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the provider** — `backend/src/infrastructure/config/RealmConfigProvider.ts`

```typescript
import { RealmConfigRepository } from '../../domain/ports/RealmConfigRepository';
import { RealmConfigSource } from '../../domain/ports/RealmConfigSource';
import { RealmConfigSet, realmConfigSetFromRows } from '../../domain/config/realms';

// In-app cache of the realm config. Loads from the DB once (ensureLoaded) and
// serves it synchronously (get) so the domain use cases keep synchronous access.
// No TTL: the only thing that changes the config is an admin write, which calls
// reload() explicitly — precise invalidation rather than time-based polling.
export class RealmConfigProvider implements RealmConfigSource {
  private set: RealmConfigSet | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly repo: RealmConfigRepository) {}

  // Idempotent and concurrency-safe: parallel first requests share one in-flight
  // load instead of each hitting the DB.
  async ensureLoaded(): Promise<void> {
    if (this.set) return;
    if (!this.loading) {
      this.loading = this.repo.loadAll().then((rows) => {
        this.set = realmConfigSetFromRows(rows);
        this.loading = null;
      });
    }
    await this.loading;
  }

  async reload(): Promise<void> {
    const rows = await this.repo.loadAll();
    this.set = realmConfigSetFromRows(rows);
  }

  get(): RealmConfigSet {
    if (!this.set) {
      throw new Error('RealmConfigProvider.get() called before ensureLoaded()');
    }
    return this.set;
  }
}
```

- [ ] **Step 4: Run the provider test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/RealmConfigProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the provider into `app.ts`**

Add imports:

```typescript
import { PrismaRealmConfigRepository } from './infrastructure/repositories/PrismaRealmConfigRepository';
import { RealmConfigProvider } from './infrastructure/config/RealmConfigProvider';
```

After `const pillRepository = ...`, add:

```typescript
  const realmConfigRepository = new PrismaRealmConfigRepository(client);
  const realmConfigProvider = new RealmConfigProvider(realmConfigRepository);
```

Update the three use-case constructions to pass the provider:

```typescript
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository, realmConfigProvider);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource, realmConfigProvider);
  const consumePillUseCase = new ConsumePillUseCase(characterRepository, pillRepository, realmConfigProvider);
```

After `app.use(express.json());` and the `/health` route, add a middleware that guarantees the config is loaded before any request that needs it:

```typescript
  // Ensure the realm config is loaded (once) before handling a request. First
  // request pays the one-time DB read; subsequent ones are a no-op. Kept out of
  // /health above so a health check never blocks on the DB.
  app.use((_req, _res, next) => {
    realmConfigProvider.ensureLoaded().then(() => next()).catch(next);
  });
```

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors (Task 1's app.ts errors are now resolved).

- [ ] **Step 7: Run the cultivation-state integration test end-to-end (reads config from DB)**

Run: `cd backend && npx vitest run tests/integration/cultivation.state.test.ts`
Expected: PASS — `/cultivation/state` now serves realm values loaded from the seeded `RealmStage` table.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/infrastructure/config/RealmConfigProvider.ts src/app.ts \
  tests/unit/RealmConfigProvider.test.ts
git commit -m "feat(backend): load realm config from DB via a boot-time provider cache"
```

---

## Task 4: Lazy clamp of out-of-range characters on read

When a character's stored stage no longer exists in the current config, `GET /cultivation/state` clamps it to the nearest valid stage and persists the correction — turning the pre-existing out-of-range 500 into a self-healing read.

**Files:**
- Modify: `backend/src/application/GetCultivationStateUseCase.ts`
- Test: `backend/tests/unit/GetCultivationStateUseCase.test.ts`

**Interfaces:**
- Consumes: `RealmConfigSet.clampStage`, `CharacterRepository.updateWithConcurrencyGuard` (existing).

- [ ] **Step 1: Write the failing test** — add to `tests/unit/GetCultivationStateUseCase.test.ts`

Add a small config with one realm of two sub-stages, seed a character out of range, and assert the response is clamped and persisted. Add this `describe` block (imports `RealmConfigSet` and `StaticRealmConfigSource`; add `import { RealmConfigSet } from '../../src/domain/config/realms';` if not present):

```typescript
describe('GetCultivationStateUseCase — out-of-range clamp', () => {
  const smallConfig = new RealmConfigSet([
    { name: 'A', subStages: [
      { name: 'A0', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      { name: 'A1', linhKhiRequired: 200, cultivationRate: 1.2, baseSuccessRate: 88, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 400 },
    ] },
  ]);

  function outOfRangeCharacter(): CharacterRecord {
    return {
      id: 'c1', userId: 'user-1', realmMajor: 3, realmSub: 9, linhKhi: 0,
      lastUpdateAt: new Date('2026-01-01T00:00:00Z'), breakthroughFails: 0,
      punishedUntil: null, cultivationBuffMultiplier: null, cultivationBuffUntil: null,
      breakthroughBonusPct: 0, createdAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  it('clamps an out-of-range character to the nearest valid stage and persists it', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(outOfRangeCharacter());
    const useCase = new GetCultivationStateUseCase(characters, new StaticRealmConfigSource(smallConfig));

    const result = await useCase.execute('user-1');
    expect(result.realmMajor).toBe(0);
    expect(result.realmSub).toBe(1); // major clamped to 0, sub clamped to that realm's peak
    expect(result.realmName).toBe('A - A1');

    // Persisted, so the next read is already in range.
    const persisted = await characters.findByUserId('user-1');
    expect(persisted?.realmMajor).toBe(0);
    expect(persisted?.realmSub).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/unit/GetCultivationStateUseCase.test.ts`
Expected: FAIL (either a thrown "cannot read subStages of undefined" or wrong realmMajor).

- [ ] **Step 3: Implement the clamp** in `GetCultivationStateUseCase.execute`

Right after `const config = this.realmConfig.get();` (added in Task 1) and before reading the stage, insert:

```typescript
    // Self-heal: if the stored stage no longer exists in the current config
    // (e.g. an admin removed a realm/sub-stage under this character), clamp to
    // the nearest valid stage and persist the correction. This is the read path,
    // so it also removes the previous out-of-range 500. Uses the existing
    // optimistic-concurrency guard; a lost race just means another request
    // already wrote — we fall through with the clamped indices for this response.
    const clamped = config.clampStage(character.realmMajor, character.realmSub);
    if (clamped.realmMajor !== character.realmMajor || clamped.realmSub !== character.realmSub) {
      character.realmMajor = clamped.realmMajor;
      character.realmSub = clamped.realmSub;
      await this.characters.updateWithConcurrencyGuard(character.id, character.lastUpdateAt, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        linhKhi: character.linhKhi,
        lastUpdateAt: character.lastUpdateAt,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
    }
```

Note: keep `lastUpdateAt` unchanged in this write so the linh-khí accrual math below is unaffected — the clamp only corrects the stage indices.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/GetCultivationStateUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/application/GetCultivationStateUseCase.ts tests/unit/GetCultivationStateUseCase.test.ts
git commit -m "feat(backend): self-heal out-of-range characters by clamping on read"
```

---

## Task 5: Admin `role` in the User model and access token

Add the `role` field end-to-end: entity, repository, token service (sign + verify), and the three token-minting use cases. Refresh re-derives the current role from the DB so a promotion takes effect on the next refresh.

**Files:**
- Modify: `backend/src/domain/entities/User.ts`, `backend/src/domain/ports/UserRepository.ts`, `backend/src/domain/ports/TokenService.ts`
- Modify: `backend/src/infrastructure/auth/JwtTokenService.ts`, `backend/src/infrastructure/repositories/PrismaUserRepository.ts`
- Modify: `backend/src/application/LoginUserUseCase.ts`, `RegisterUserUseCase.ts`, `RefreshAccessTokenUseCase.ts`
- Modify: `backend/src/presentation/middleware/auth.ts`
- Modify test fakes: `backend/tests/fakes/FakeTokenService.ts`, `backend/tests/fakes/InMemoryUserRepository.ts`
- Test: `backend/tests/unit/JwtTokenService.test.ts`, `RefreshAccessTokenUseCase.test.ts`

**Interfaces:**
- Produces:
  - `TokenService.signAccessToken(userId: string, role: string): string`; `verifyAccessToken(token): { userId: string; role: string }`.
  - `UserRepository.findById(id: string): Promise<UserRecord | null>`.
  - `UserRecord.role: string`.
  - `AuthedRequest.role?: string`.

- [ ] **Step 1: Update `UserRecord`** — `backend/src/domain/entities/User.ts`

```typescript
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: string; // "user" | "admin"
  createdAt: Date;
}
```

- [ ] **Step 2: Update `UserRepository` port** — add `findById`

```typescript
import { UserRecord } from '../entities/User';

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { username: string; passwordHash: string }): Promise<UserRecord>;
}
```

- [ ] **Step 3: Update `TokenService` port**

```typescript
export interface TokenService {
  signAccessToken(userId: string, role: string): string;
  verifyAccessToken(token: string): { userId: string; role: string };
  signRefreshToken(userId: string): string;
  verifyRefreshToken(token: string): { userId: string };
}
```

- [ ] **Step 4: Write the failing token test** — add to `tests/unit/JwtTokenService.test.ts`

```typescript
  it('round-trips the role claim through the access token', () => {
    const service = new JwtTokenService('access-secret', 'refresh-secret');
    const token = service.signAccessToken('user-123', 'admin');
    expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123', role: 'admin' });
  });
```

Also update the existing assertion at line 9 from `{ userId: 'user-123' }` to `{ userId: 'user-123', role: 'user' }`, and change its signer call to `service.signAccessToken('user-123', 'user')`. Update every other `signAccessToken('user-123')` call in this file to pass a second arg `'user'`.

- [ ] **Step 5: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/unit/JwtTokenService.test.ts`
Expected: FAIL (signature/shape mismatch).

- [ ] **Step 6: Update `JwtTokenService`**

```typescript
  signAccessToken(userId: string, role: string): string {
    // role travels in the access token (15m) so requireAdmin can authorize
    // without a DB lookup per request. jti + typ rationale unchanged (see below).
    return jwt.sign({ userId, role, jti: randomUUID(), typ: 'access' }, this.accessSecret, { expiresIn: '15m' });
  }

  verifyAccessToken(token: string): { userId: string; role: string } {
    const payload = jwt.verify(token, this.accessSecret) as { userId: string; role?: string; typ?: string; [key: string]: unknown };
    if (payload.typ !== 'access') {
      throw new Error('Token is not an access token');
    }
    // Tokens minted before roles existed have no role claim; treat them as "user".
    return { userId: payload.userId, role: payload.role ?? 'user' };
  }
```

(Keep the existing explanatory comment block above `signAccessToken`.)

- [ ] **Step 7: Run the token test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/JwtTokenService.test.ts`
Expected: PASS.

- [ ] **Step 8: Update `PrismaUserRepository`** — `findById` + role flows through automatically

Add:

```typescript
  async findById(id: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { id } });
  }
```

(`create` and `findByUsername` already return the full row, which now includes `role`.)

- [ ] **Step 9: Update the token-minting use cases**

`LoginUserUseCase` (line 34): `const token = this.tokenService.signAccessToken(user.id, user.role);`

`RegisterUserUseCase` (line 44): `const accessToken = this.tokenService.signAccessToken(user.id, user.role);` (a freshly created user has `role: 'user'` from the DB default).

`RefreshAccessTokenUseCase` — give it a `UserRepository` so it mints the access token with the user's *current* role (so a promotion takes effect on refresh):

```typescript
import { TokenService } from '../domain/ports/TokenService';
import { UserRepository } from '../domain/ports/UserRepository';
import { DomainError } from '../domain/errors';

export interface RefreshAccessTokenOutput {
  token: string;
  refreshToken: string;
}

export class RefreshAccessTokenUseCase {
  constructor(
    private readonly tokenService: TokenService,
    private readonly users: UserRepository,
  ) {}

  async execute(refreshToken: string): Promise<RefreshAccessTokenOutput> {
    let userId: string;
    try {
      ({ userId } = this.tokenService.verifyRefreshToken(refreshToken));
    } catch {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    // Re-read the user so the refreshed access token reflects the current role
    // (e.g. a just-granted admin role) rather than a stale claim.
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'User no longer exists');
    }

    const token = this.tokenService.signAccessToken(user.id, user.role);
    const newRefreshToken = this.tokenService.signRefreshToken(user.id);
    return { token, refreshToken: newRefreshToken };
  }
}
```

Note: `execute` is now `async`. The auth route already awaits nothing here — update `auth.routes.ts` `/refresh` handler to `const result = await deps.refreshAccessTokenUseCase.execute(refreshToken);`.

- [ ] **Step 10: Attach `role` in `requireAuth`** — `backend/src/presentation/middleware/auth.ts`

Extend the interface and set the field:

```typescript
export interface AuthedRequest extends Request {
  userId?: string;
  role?: string;
}
```

In the `try` block, after `req.userId = payload.userId;` add `req.role = payload.role;`.

- [ ] **Step 11: Update the fakes**

`tests/fakes/FakeTokenService.ts` — carry role in the access token string:

```typescript
  signAccessToken(userId: string, role: string): string {
    return `access-token-for-${role}:${userId}`;
  }

  verifyAccessToken(token: string): { userId: string; role: string } {
    if (!token.startsWith('access-token-for-')) {
      throw new Error('invalid token');
    }
    const body = token.replace('access-token-for-', '');
    const [role, userId] = body.split(':');
    return { userId, role };
  }
```

(Leave `signRefreshToken`/`verifyRefreshToken` unchanged.)

`tests/fakes/InMemoryUserRepository.ts` — default role, `findById`, and an admin-seed helper:

```typescript
  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      username: input.username,
      passwordHash: input.passwordHash,
      role: 'user',
      createdAt: new Date(),
    };
    this.usersById.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  /** Test helper — not part of the port — to promote a seeded user. */
  setRole(id: string, role: string): void {
    const user = this.usersById.get(id);
    if (user) this.usersById.set(id, { ...user, role });
  }
```

- [ ] **Step 12: Fix the token-literal assertions and refresh test**

`tests/unit/LoginUserUseCase.test.ts` line 22 → `expect(result.token).toBe(\`access-token-for-user:${registered.id}\`);` (registered users are role `user`).

`tests/unit/RegisterUserUseCase.test.ts` line 20 → `expect(result.accessToken).toBe(\`access-token-for-user:${result.id}\`);`

`tests/unit/auth.middleware.test.ts` — the `signAccessToken('user-123')` calls (lines 36, 43, 50, 51) now need a role arg; add `'user'` (e.g. `signAccessToken('user-123', 'user')`). These tests round-trip through the fake, so no literal changes beyond the extra arg.

`tests/unit/RefreshAccessTokenUseCase.test.ts` — the use case now needs a `UserRepository` and is async. Update construction and seed a user:

```typescript
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
// ...
const tokenService = new FakeTokenService();
const users = new InMemoryUserRepository();
const created = await users.create({ username: 'u', passwordHash: 'h' }); // id "user-1"
const refreshToken = tokenService.signRefreshToken(created.id);
const useCase = new RefreshAccessTokenUseCase(tokenService, users);
const result = await useCase.execute(refreshToken);
expect(result.token).toBe(`access-token-for-user:${created.id}`);
expect(result.refreshToken).toBe(`refresh-token-for-${created.id}`);
```

Update the two remaining cases (invalid token, access-token-as-refresh) to `await useCase.execute(...)` and construct with `new RefreshAccessTokenUseCase(new FakeTokenService(), new InMemoryUserRepository())`.

- [ ] **Step 13: Update `app.ts` refresh wiring**

`RefreshAccessTokenUseCase` now takes the user repo: `const refreshAccessTokenUseCase = new RefreshAccessTokenUseCase(tokenService, userRepository);`

- [ ] **Step 14: Run all affected unit tests**

Run: `cd backend && npx vitest run tests/unit/JwtTokenService.test.ts tests/unit/LoginUserUseCase.test.ts tests/unit/RegisterUserUseCase.test.ts tests/unit/auth.middleware.test.ts tests/unit/RefreshAccessTokenUseCase.test.ts`
Expected: PASS.

- [ ] **Step 15: Typecheck**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 16: Commit**

```bash
cd backend && git add src/domain/entities/User.ts src/domain/ports/UserRepository.ts \
  src/domain/ports/TokenService.ts src/infrastructure/auth/JwtTokenService.ts \
  src/infrastructure/repositories/PrismaUserRepository.ts \
  src/application/LoginUserUseCase.ts src/application/RegisterUserUseCase.ts \
  src/application/RefreshAccessTokenUseCase.ts src/presentation/middleware/auth.ts \
  src/app.ts tests/fakes/FakeTokenService.ts tests/fakes/InMemoryUserRepository.ts \
  tests/unit/JwtTokenService.test.ts tests/unit/LoginUserUseCase.test.ts \
  tests/unit/RegisterUserUseCase.test.ts tests/unit/auth.middleware.test.ts \
  tests/unit/RefreshAccessTokenUseCase.test.ts
git commit -m "feat(backend): add admin role, carried in the access token and refreshed from DB"
```

---

## Task 6: `requireAdmin` middleware + error codes

Add the admin-authorization middleware and map its error code.

**Files:**
- Create: `backend/src/presentation/middleware/requireAdmin.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Test: `backend/tests/unit/requireAdmin.test.ts` (create), `backend/tests/unit/errorHandler.test.ts`

**Interfaces:**
- Produces: `requireAdmin(req: AuthedRequest, res, next)` — throws `DomainError('FORBIDDEN', ...)` when `req.role !== 'admin'` by calling `next(err)`.

- [ ] **Step 1: Write the failing middleware test** — `backend/tests/unit/requireAdmin.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../../src/presentation/middleware/requireAdmin';
import { AuthedRequest } from '../../src/presentation/middleware/auth';
import { DomainError } from '../../src/domain/errors';
import { Response } from 'express';

function run(role: string | undefined) {
  const req = { role } as AuthedRequest;
  const next = vi.fn();
  requireAdmin(req, {} as Response, next);
  return next;
}

describe('requireAdmin', () => {
  it('passes an admin through with no error', () => {
    const next = run('admin');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a regular user with FORBIDDEN', () => {
    const next = run('user');
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('rejects a missing role with FORBIDDEN', () => {
    const next = run(undefined);
    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/unit/requireAdmin.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `requireAdmin`** — `backend/src/presentation/middleware/requireAdmin.ts`

```typescript
import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';
import { DomainError } from '../../domain/errors';

// Authorization guard — must run AFTER requireAuth (which sets req.role from the
// access token). Non-admins are rejected via next(err) so the central
// errorHandler maps FORBIDDEN → 403, keeping HTTP-status decisions in one place.
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (req.role !== 'admin') {
    next(new DomainError('FORBIDDEN', 'Admin privileges required'));
    return;
  }
  next();
}
```

- [ ] **Step 4: Run the middleware test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/requireAdmin.test.ts`
Expected: PASS.

- [ ] **Step 5: Add error codes** — `backend/src/presentation/middleware/errorHandler.ts`

Add to `STATUS_BY_CODE`:

```typescript
  FORBIDDEN: 403,
  INVALID_REALM_CONFIG: 400,
```

- [ ] **Step 6: Extend the errorHandler test** — `backend/tests/unit/errorHandler.test.ts`

Add a case asserting a `DomainError('FORBIDDEN', ...)` yields status 403 (follow the file's existing pattern for the known-code case):

```typescript
  it('maps FORBIDDEN to 403', () => {
    const { res, statusMock, jsonMock } = makeRes();
    errorHandler(new DomainError('FORBIDDEN', 'nope'), {} as any, res, (() => {}) as any);
    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({ error: { code: 'FORBIDDEN', message: 'nope' } });
  });
```

(Match the existing helper names in the file; if it constructs `res` differently, mirror that.)

- [ ] **Step 7: Run the errorHandler test**

Run: `cd backend && npx vitest run tests/unit/errorHandler.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/presentation/middleware/requireAdmin.ts \
  src/presentation/middleware/errorHandler.ts tests/unit/requireAdmin.test.ts \
  tests/unit/errorHandler.test.ts
git commit -m "feat(backend): add requireAdmin middleware and FORBIDDEN/INVALID_REALM_CONFIG codes"
```

---

## Task 7: `UpdateRealmConfigUseCase` + validation

The use case validates a submitted config (business invariants beyond zod's shape checks) and replaces the stored config atomically.

**Files:**
- Create: `backend/src/application/UpdateRealmConfigUseCase.ts`
- Test: `backend/tests/unit/UpdateRealmConfigUseCase.test.ts`

**Interfaces:**
- Consumes: `RealmConfigRepository`, `RealmConfig`, `flattenRealms`.
- Produces: `class UpdateRealmConfigUseCase { execute(realms: RealmConfig[]): Promise<RealmConfig[]> }` — throws `DomainError('INVALID_REALM_CONFIG', ...)` on invariant violation.

- [ ] **Step 1: Write the failing test** — `backend/tests/unit/UpdateRealmConfigUseCase.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { UpdateRealmConfigUseCase } from '../../src/application/UpdateRealmConfigUseCase';
import { InMemoryRealmConfigRepository } from '../fakes/InMemoryRealmConfigRepository';
import { RealmConfig } from '../../src/domain/config/realms';
import { DomainError } from '../../src/domain/errors';

function stage(name: string, linhKhiRequired: number) {
  return { name, linhKhiRequired, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 };
}

const valid: RealmConfig[] = [
  { name: 'A', subStages: [stage('A0', 100), stage('A1', 200)] },
  { name: 'B', subStages: [stage('B0', 300)] },
];

describe('UpdateRealmConfigUseCase', () => {
  it('persists a valid config and returns it', async () => {
    const repo = new InMemoryRealmConfigRepository();
    const result = await new UpdateRealmConfigUseCase(repo).execute(valid);
    expect(result).toEqual(valid);
    const rows = await repo.loadAll();
    expect(rows).toHaveLength(3);
    expect(rows[2].realmName).toBe('B');
  });

  it('rejects a non-increasing linhKhiRequired across the flat order', async () => {
    const bad: RealmConfig[] = [
      { name: 'A', subStages: [stage('A0', 200), stage('A1', 150)] },
    ];
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute(bad))
      .rejects.toMatchObject({ code: 'INVALID_REALM_CONFIG' });
  });

  it('rejects an empty realm list', async () => {
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute([]))
      .rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a realm with no sub-stages', async () => {
    const bad: RealmConfig[] = [{ name: 'A', subStages: [] }];
    await expect(new UpdateRealmConfigUseCase(new InMemoryRealmConfigRepository()).execute(bad))
      .rejects.toMatchObject({ code: 'INVALID_REALM_CONFIG' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/unit/UpdateRealmConfigUseCase.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the use case** — `backend/src/application/UpdateRealmConfigUseCase.ts`

```typescript
import { RealmConfigRepository } from '../domain/ports/RealmConfigRepository';
import { RealmConfig, flattenRealms } from '../domain/config/realms';
import { DomainError } from '../domain/errors';

// Validates + atomically replaces the realm config. zod (presentation) already
// guarantees field types/ranges and array min-lengths; this use case enforces the
// cross-cutting business invariants zod can't express, then delegates the atomic
// swap to the repository.
export class UpdateRealmConfigUseCase {
  constructor(private readonly repo: RealmConfigRepository) {}

  async execute(realms: RealmConfig[]): Promise<RealmConfig[]> {
    if (realms.length === 0) {
      throw new DomainError('INVALID_REALM_CONFIG', 'At least one realm is required');
    }
    for (const realm of realms) {
      if (realm.subStages.length === 0) {
        throw new DomainError('INVALID_REALM_CONFIG', `Realm "${realm.name}" has no sub-stages`);
      }
    }

    // linhKhiRequired must strictly increase across the whole progression (flat
    // major→sub order) — the monotonic invariant the accrual/breakthrough loop
    // relies on. Nested arrays already give contiguous indices, so no gap check
    // is needed here.
    const rows = flattenRealms(realms);
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].linhKhiRequired <= rows[i - 1].linhKhiRequired) {
        throw new DomainError(
          'INVALID_REALM_CONFIG',
          `linhKhiRequired must strictly increase (violation at realm ${rows[i].realmMajor}, sub ${rows[i].realmSub})`,
        );
      }
    }

    await this.repo.replaceAll(rows);
    return realms;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/UpdateRealmConfigUseCase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/application/UpdateRealmConfigUseCase.ts tests/unit/UpdateRealmConfigUseCase.test.ts
git commit -m "feat(backend): add UpdateRealmConfigUseCase with config invariants"
```

---

## Task 8: Admin routes `GET`/`PUT /admin/realms` + wiring

Expose the endpoints, validate the PUT body with zod, reload the provider after a write, and verify end-to-end against Postgres.

**Files:**
- Create: `backend/src/presentation/schemas/admin.schemas.ts`
- Create: `backend/src/presentation/routes/admin.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/admin.routes.test.ts` (create)

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin`, `UpdateRealmConfigUseCase`, `RealmConfigProvider` (`get`, `reload`).

- [ ] **Step 1: Create the zod schema** — `backend/src/presentation/schemas/admin.schemas.ts`

```typescript
import { z } from 'zod';

// Nested realm config for PUT /admin/realms. Nested arrays inherently give
// contiguous realm/sub indices; per-field ranges are enforced here, and the
// cross-cutting monotonic-linhKhi rule is enforced in UpdateRealmConfigUseCase.
const subStageSchema = z.object({
  name: z.string().min(1),
  linhKhiRequired: z.number().positive(),
  cultivationRate: z.number().positive(),
  baseSuccessRate: z.number().min(0).max(100),
  pityIncrement: z.number().min(0),
  maxSuccessRate: z.number().min(0).max(100),
  punishmentSeconds: z.number().int().min(0),
});

const realmSchema = z.object({
  name: z.string().min(1),
  subStages: z.array(subStageSchema).min(1),
});

export const updateRealmsSchema = z.object({
  realms: z.array(realmSchema).min(1),
});

export type UpdateRealmsInput = z.infer<typeof updateRealmsSchema>;
```

- [ ] **Step 2: Write the failing integration test** — `backend/tests/integration/admin.routes.test.ts`

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

async function registerAdminAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  // Promote directly in the DB, then log in so the access token carries role:admin.
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Restore the seeded config so later suites see the standard 12×5 data.
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  await prisma.$disconnect();
});

describe('/admin/realms', () => {
  it('rejects a non-admin with 403', async () => {
    const token = await registerAndLogin('bob');
    const res = await request(app).get('/admin/realms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin read the current config', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).get('/admin/realms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.realms[0].subStages[0].linhKhiRequired).toBe(100);
  });

  it('applies a PUT and reflects it immediately on /cultivation/state', async () => {
    const adminToken = await registerAdminAndLogin('root');
    // Read current config, bump realm 0 sub 0's linhKhiRequired, put it back.
    const current = await request(app).get('/admin/realms').set('Authorization', `Bearer ${adminToken}`);
    const realms = current.body.realms;
    realms[0].subStages[0].linhKhiRequired = 123;

    const put = await request(app).put('/admin/realms')
      .set('Authorization', `Bearer ${adminToken}`).send({ realms });
    expect(put.status).toBe(200);

    // A fresh player at realm 0 sub 0 should now see the new requirement.
    const playerToken = await registerAndLogin('alice');
    const state = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${playerToken}`);
    expect(state.body.linhKhiRequired).toBe(123);
  });

  it('rejects an invalid PUT (non-increasing linhKhi) with 400', async () => {
    const adminToken = await registerAdminAndLogin('root');
    const res = await request(app).put('/admin/realms').set('Authorization', `Bearer ${adminToken}`).send({
      realms: [{ name: 'A', subStages: [
        { name: 'A0', linhKhiRequired: 200, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
        { name: 'A1', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      ] }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REALM_CONFIG');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && npx vitest run tests/integration/admin.routes.test.ts`
Expected: FAIL (no `/admin` routes → 404).

- [ ] **Step 4: Create the router** — `backend/src/presentation/routes/admin.routes.ts`

```typescript
import { Router, RequestHandler } from 'express';
import { updateRealmsSchema } from '../schemas/admin.schemas';
import { UpdateRealmConfigUseCase } from '../../application/UpdateRealmConfigUseCase';
import { RealmConfigProvider } from '../../infrastructure/config/RealmConfigProvider';
import { requireAdmin } from '../middleware/requireAdmin';
import { DomainError } from '../../domain/errors';

export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
  realmConfigProvider: RealmConfigProvider;
  requireAuth: RequestHandler;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  // Every /admin route requires a valid session (requireAuth) AND admin role.
  router.use(deps.requireAuth, requireAdmin);

  router.get('/realms', (_req, res) => {
    // Serve the nested config from the in-memory provider (already loaded).
    res.status(200).json({ realms: deps.realmConfigProvider.get().toRealms() });
  });

  router.put('/realms', async (req, res, next) => {
    try {
      const parsed = updateRealmsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REALM_CONFIG', parsed.error.issues[0].message);
      }
      const saved = await deps.updateRealmConfigUseCase.execute(parsed.data.realms);
      // Reload the cache so the new config is live for every subsequent request.
      await deps.realmConfigProvider.reload();
      res.status(200).json({ realms: saved });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 5: Wire it in `app.ts`**

Add imports:

```typescript
import { UpdateRealmConfigUseCase } from './application/UpdateRealmConfigUseCase';
import { createAdminRouter } from './presentation/routes/admin.routes';
```

After the other use-case constructions add:

```typescript
  const updateRealmConfigUseCase = new UpdateRealmConfigUseCase(realmConfigRepository);
```

After the `/pills` router mount add:

```typescript
  app.use(
    '/admin',
    createAdminRouter({ updateRealmConfigUseCase, realmConfigProvider, requireAuth }),
  );
```

- [ ] **Step 6: Run the admin integration test to verify it passes**

Run: `cd backend && npx vitest run tests/integration/admin.routes.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the whole backend suite**

Run: `cd backend && npm test`
Expected: all green (existing 145 + the new unit/integration tests).

- [ ] **Step 8: Manual verification (cookie jar, Docker Postgres)**

```bash
cd backend && docker compose up -d --build
# Register + promote + login as admin
curl -s -c jar.txt -X POST localhost:5000/auth/register -H 'Content-Type: application/json' -d '{"username":"root","password":"password123"}' >/dev/null
docker compose exec -T db psql -U postgres -d app -c "UPDATE \"User\" SET role='admin' WHERE username='root';"
curl -s -c jar.txt -X POST localhost:5000/auth/login -H 'Content-Type: application/json' -d '{"username":"root","password":"password123"}' >/dev/null
# Read, mutate realm 0 sub 0, put back, confirm on a player
curl -s -b jar.txt localhost:5000/admin/realms | head -c 300
# (edit the JSON, PUT it) then register a player and GET /cultivation/state to see the new linhKhiRequired
```
Expected: non-admin GET/PUT → 403; admin GET → config; PUT with bad linhKhi → 400 `INVALID_REALM_CONFIG`; PUT valid → player's `/cultivation/state` shows the new value; a character with a manually corrupted `realmSub` (e.g. `UPDATE "Character" SET "realmSub"=9`) → `/cultivation/state` returns 200 clamped (no 500).

- [ ] **Step 9: Update `CLAUDE.md`**

Add a "Realm Config in DB + Admin API" section summarizing: `RealmStage` table + `User.role`; `RealmConfigSet`/`RealmConfigSource`/`RealmConfigProvider` (boot-load + synchronous get + reload-on-write); the three use cases now injected with the source; lazy clamp-on-read self-heals out-of-range characters (fixes the old 500); role carried in the access token, re-derived from DB on refresh; `requireAdmin` + `FORBIDDEN`/`INVALID_REALM_CONFIG` codes; `GET`/`PUT /admin/realms`; admin bootstrap via SQL (`UPDATE "User" SET role='admin'`). Note the final test count from `npm test`.

- [ ] **Step 10: Commit**

```bash
cd backend && git add src/presentation/schemas/admin.schemas.ts \
  src/presentation/routes/admin.routes.ts src/app.ts \
  tests/integration/admin.routes.test.ts ../CLAUDE.md
git commit -m "feat(backend): add GET/PUT /admin/realms with admin auth and live reload"
```

---

## Self-Review Notes

- **Spec coverage:** schema/table (Task 2), `User.role` (Task 2/5), `RealmConfigSet`+clamp (Task 1/4), repository+atomic replaceAll (Task 2), provider cache+reload (Task 3), three use cases injected (Task 1/3), lazy clamp fixing the 500 (Task 4), admin role in token + refresh re-derivation (Task 5), `requireAdmin`+codes (Task 6), `UpdateRealmConfigUseCase`+validation (Task 7), routes+wiring+reload+manual verify+seed+bootstrap (Task 8). All spec sections map to a task.
- **Out of scope confirmed:** no admin UI, no PATCH, no audit log, no frontend `SUB_STAGE_NAMES` change (frontend reads `realmName` from the DTO).
- **Type consistency:** `signAccessToken(userId, role)` / `verifyAccessToken → { userId, role }` used identically in JwtTokenService, FakeTokenService, requireAuth, and all three minting use cases; `RealmConfigSource.get()` consumed by the three use cases and implemented by both `RealmConfigProvider` and `StaticRealmConfigSource`; `SubStageRow` shape identical across `realms.ts`, both repositories, and the provider.
