# Đan Dược Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the đan dược (alchemy) inventory a real Node/Express backend — persist each player's pills, expose the inventory, and let a player consume a pill to apply one of four effects to their cultivation state, race-safe on the server.

**Architecture:** Clean Architecture, matching the existing backend. New `domain/pills/` pure logic + `PillRepository` port; `GetInventoryUseCase`/`ConsumePillUseCase` in `application/`; `PrismaPillRepository` + a Prisma seed in `infrastructure/`; `pills.routes.ts` in `presentation/`. Timed cultivation buffs use faithful piecewise integration inside `computeLinhKhi`; `breakthroughBoost` is a `breakthroughBonusPct` field on Character consumed by the existing breakthrough use case.

**Tech Stack:** TypeScript, Express, Prisma (Postgres), zod, Vitest. `npm test` runs unit (pure + fakes) and integration (real Postgres) tests.

## Global Constraints

- Clean Architecture: `domain/` imports nothing from `infrastructure/`/`presentation/`; `application/` depends only on domain ports. `domain/pills/*` is pure (no framework).
- Non-trivial business logic (formulas, concurrency, piecewise accrual) must carry clear "why" comments.
- Use context7 (`ctx7` CLI) before writing library-specific code (Prisma, zod, Express) — cross-check against pinned versions (`prisma`/`@prisma/client`, `zod ^3.23.8`, `express`).
- DomainError carries a `code` only; HTTP status mapping lives solely in `errorHandler`.
- Optimistic concurrency: character writes go through `updateWithConcurrencyGuard(id, expectedLastUpdateAt, data)`; every writer must set ALL `CharacterUpdateInput` fields (carry-through) or the guard silently drops them.
- Commit messages OMIT any Co-Authored-By / Claude attribution trailer.
- Backend commands run from `backend/`: `npm test`, `npx prisma migrate dev`, `docker compose up -d --build`.
- All existing tests must stay green — `computeLinhKhi`'s new `buff` param is optional and defaults to today's exact behavior.
- Work on branch `feat/dan-duoc-backend` (create from `main`).

---

### Task 0: Branch setup

**Files:** none (git only).

- [ ] **Step 1: Create the branch from main**

```bash
git -C <repo> checkout main
git -C <repo> checkout -b feat/dan-duoc-backend
git -C <repo> branch --show-current   # expect: feat/dan-duoc-backend
```

(The design spec `docs/superpowers/specs/2026-07-18-dan-duoc-backend-design.md` was committed on the prior branch; it is already on `main` if that branch merged, otherwise cherry-pick or re-copy it. If missing, copy it in and commit before Task 1.)

---

### Task 1: Prisma schema, migration, and pill seed

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (add `prisma.seed` config + `db:seed` script)
- Test: `backend/tests/integration/pills-schema.test.ts`

**Interfaces:**
- Consumes: existing `User`, `Character` models.
- Produces: `Pill` and `InventoryItem` tables; Character fields `cultivationBuffMultiplier`, `cultivationBuffUntil`, `breakthroughBonusPct`; the 8 seeded pill rows with ids `hoi-khi-dan`, `tu-linh-dan`, `cuu-chuyen-kim-dan`, `tinh-tam-dan`, `ngung-than-dan`, `pha-canh-dan`, `thien-cang-dan`, `giai-phat-dan`.

- [ ] **Step 1: Add models + Character fields to the schema**

In `backend/prisma/schema.prisma`, add to the `User` model a relation field:

```prisma
  character    Character?
  inventory    InventoryItem[]
```

Add to the `Character` model (after `punishedUntil`):

```prisma
  // Active timed cultivation buff (from a consumed pill). Both null when no buff
  // is active. computeLinhKhi integrates the buffed segment at rate × multiplier.
  cultivationBuffMultiplier Float?
  cultivationBuffUntil      DateTime?

  // Pending one-shot breakthrough success-rate bonus (percentage points) from a
  // consumed pill; added to the next attempt's rate, then reset to 0.
  breakthroughBonusPct      Float     @default(0)
```

Append two new models:

```prisma
model Pill {
  id          String          @id
  name        String
  glyph       String
  rarity      Int
  effectKind  String
  amount      Float?
  multiplier  Float?
  durationSec Int?
  bonusPct    Float?
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

  @@unique([userId, pillId])
}
```

- [ ] **Step 2: Write the seed script**

Create `backend/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Pill catalog mirrors the frontend mock (frontend/src/lib/pill-constants.ts):
// same ids, rarities (0..4), and four effect kinds. Definitions live in the DB
// (not config-in-code) so the catalog can change without a code deploy.
const PILLS = [
  { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', amount: 50, desc: 'Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.' },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', glyph: '聚', rarity: 2, effectKind: 'linhKhi', amount: 300, desc: 'Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.' },
  { id: 'cuu-chuyen-kim-dan', name: 'Cửu Chuyển Kim Đan', glyph: '金', rarity: 4, effectKind: 'linhKhi', amount: 2000, desc: 'Thánh dược cửu chuyển, cộng ngay 2000 linh khí.' },
  { id: 'tinh-tam-dan', name: 'Tịnh Tâm Đan', glyph: '静', rarity: 1, effectKind: 'cultivationBuff', multiplier: 1.5, durationSec: 120, desc: 'Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.' },
  { id: 'ngung-than-dan', name: 'Ngưng Thần Đan', glyph: '凝', rarity: 3, effectKind: 'cultivationBuff', multiplier: 2, durationSec: 180, desc: 'Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.' },
  { id: 'pha-canh-dan', name: 'Phá Cảnh Đan', glyph: '破', rarity: 2, effectKind: 'breakthroughBoost', bonusPct: 15, desc: 'Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.' },
  { id: 'thien-cang-dan', name: 'Thiên Cang Đan', glyph: '罡', rarity: 4, effectKind: 'breakthroughBoost', bonusPct: 40, desc: 'Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.' },
  { id: 'giai-phat-dan', name: 'Giải Phạt Đan', glyph: '解', rarity: 3, effectKind: 'clearPunishment', desc: 'Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.' },
];

async function main() {
  for (const p of PILLS) {
    // Idempotent: re-running the seed updates definitions without duplicating.
    await prisma.pill.upsert({ where: { id: p.id }, create: p, update: p });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 3: Register the seed in package.json**

In `backend/package.json`, add a `db:seed` script and a `prisma.seed` config:

```json
  "scripts": {
    "db:seed": "tsx prisma/seed.ts"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
```

(Merge into the existing `scripts` object; add the top-level `prisma` key.)

- [ ] **Step 4: Generate the migration + client, run the seed**

Run:
```bash
cd backend
npx prisma migrate dev --name dan_duoc
npm run db:seed
```
Expected: migration `..._dan_duoc` created and applied; seed prints no errors.

- [ ] **Step 5: Write the schema integration test**

Create `backend/tests/integration/pills-schema.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('pills schema + seed', () => {
  beforeAll(async () => {
    // Ensure the catalog exists even if this file runs before a manual seed.
    const { execSync } = await import('node:child_process');
    execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('seeds all 8 pills with valid rarities and effect kinds', async () => {
    const pills = await prisma.pill.findMany();
    expect(pills.length).toBeGreaterThanOrEqual(8);
    const kinds = ['linhKhi', 'cultivationBuff', 'breakthroughBoost', 'clearPunishment'];
    for (const p of pills) {
      expect(p.rarity).toBeGreaterThanOrEqual(0);
      expect(p.rarity).toBeLessThanOrEqual(4);
      expect(kinds).toContain(p.effectKind);
    }
  });

  it('exposes the new Character buff/bonus columns with defaults', async () => {
    const user = await prisma.user.create({ data: { username: `schema-${Date.now()}`, passwordHash: 'x' } });
    const c = await prisma.character.create({ data: { userId: user.id } });
    expect(c.breakthroughBonusPct).toBe(0);
    expect(c.cultivationBuffMultiplier).toBeNull();
    expect(c.cultivationBuffUntil).toBeNull();
    await prisma.character.delete({ where: { id: c.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npm test -- pills-schema`
Expected: PASS (2 tests). Existing suite still green (`npm test`).

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/prisma/seed.ts backend/package.json backend/tests/integration/pills-schema.test.ts
git commit -m "feat(backend): add Pill/InventoryItem schema, migration, and pill seed"
```

---

### Task 2: Piecewise cultivation-buff accrual in computeLinhKhi

**Files:**
- Modify: `backend/src/domain/cultivation/cultivation.calc.ts`
- Modify: `backend/tests/unit/cultivation.calc.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `computeLinhKhi` accepts optional `buff?: { multiplier: number; until: Date }`. Behavior identical to today when `buff` is absent.

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/unit/cultivation.calc.test.ts`:

```ts
describe('computeLinhKhi with cultivation buff', () => {
  const base = new Date('2026-01-01T00:00:00Z');

  it('is unchanged when no buff is given (backward compatible)', () => {
    const now = new Date(base.getTime() + 100_000); // 100s
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2 });
    expect(v).toBeCloseTo(200, 5); // 100s * 2
  });

  it('accrues the whole window at rate*multiplier when buff covers it', () => {
    const now = new Date(base.getTime() + 100_000);
    const until = new Date(base.getTime() + 200_000); // buff outlives the window
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 2, until } });
    expect(v).toBeCloseTo(400, 5); // 100s * 2 * 2
  });

  it('splits buffed and un-buffed segments when the buff expires mid-window', () => {
    const now = new Date(base.getTime() + 100_000);   // window 100s
    const until = new Date(base.getTime() + 40_000);  // buff ends at 40s
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 3, until } });
    // buffed: 40s * 2 * 3 = 240 ; un-buffed: 60s * 2 = 120 ; total 360
    expect(v).toBeCloseTo(360, 5);
  });

  it('ignores a buff that already expired before the window', () => {
    const now = new Date(base.getTime() + 100_000);
    const until = new Date(base.getTime() - 10_000); // expired before lastUpdateAt
    const v = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt: base, now, cultivationRate: 2, buff: { multiplier: 5, until } });
    expect(v).toBeCloseTo(200, 5); // as if no buff
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- cultivation.calc`
Expected: FAIL — `buff` not handled (buffed cases return un-buffed values).

- [ ] **Step 3: Implement piecewise integration**

Replace the body of `computeLinhKhi` in `backend/src/domain/cultivation/cultivation.calc.ts`:

```ts
export function computeLinhKhi(params: {
  storedLinhKhi: number;
  lastUpdateAt: Date;
  now: Date;
  cultivationRate: number;
  offlineCapSeconds?: number;
  // Optional active timed buff. The window [lastUpdateAt, now] is split into a
  // buffed segment [lastUpdateAt, min(now, until)] accruing at rate × multiplier
  // and the remainder accruing at rate. Absent/expired buff ⇒ today's behavior.
  buff?: { multiplier: number; until: Date };
}): number {
  const cap = params.offlineCapSeconds ?? OFFLINE_CAP_SECONDS;
  const totalElapsed = Math.max(0, (params.now.getTime() - params.lastUpdateAt.getTime()) / 1000);
  // Cap first (existing rule): a week offline must not accrue a week of linh khí.
  const cappedSeconds = Math.min(totalElapsed, cap);
  const cappedEnd = params.lastUpdateAt.getTime() + cappedSeconds * 1000;

  let buffedSeconds = 0;
  if (params.buff) {
    // Overlap of [lastUpdateAt, cappedEnd] with (-inf, until]. Clamp to >= 0 so
    // an already-expired buff contributes nothing.
    const buffEnd = Math.min(cappedEnd, params.buff.until.getTime());
    buffedSeconds = Math.max(0, (buffEnd - params.lastUpdateAt.getTime()) / 1000);
  }
  const plainSeconds = cappedSeconds - buffedSeconds;

  const multiplier = params.buff?.multiplier ?? 1;
  return (
    params.storedLinhKhi +
    buffedSeconds * params.cultivationRate * multiplier +
    plainSeconds * params.cultivationRate
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npm test -- cultivation.calc`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/cultivation/cultivation.calc.ts backend/tests/unit/cultivation.calc.test.ts
git commit -m "feat(backend): piecewise cultivation-buff accrual in computeLinhKhi"
```

---

### Task 3: Breakthrough success-rate bonus term

**Files:**
- Modify: `backend/src/domain/breakthrough/breakthrough.calc.ts`
- Modify: `backend/tests/unit/breakthrough.calc.test.ts`

**Interfaces:**
- Produces: `computeSuccessRate` accepts optional `bonusPct` added before the `maxSuccessRate` clamp.

- [ ] **Step 1: Write failing tests**

Append to `backend/tests/unit/breakthrough.calc.test.ts`:

```ts
describe('computeSuccessRate with breakthrough bonus', () => {
  it('adds bonusPct to the raw rate', () => {
    const r = computeSuccessRate({ baseSuccessRate: 50, pityIncrement: 0, maxSuccessRate: 95, breakthroughFails: 0, bonusPct: 20 });
    expect(r).toBe(70);
  });

  it('still clamps at maxSuccessRate after adding the bonus', () => {
    const r = computeSuccessRate({ baseSuccessRate: 90, pityIncrement: 0, maxSuccessRate: 95, breakthroughFails: 0, bonusPct: 40 });
    expect(r).toBe(95);
  });

  it('defaults bonusPct to 0 when omitted', () => {
    const r = computeSuccessRate({ baseSuccessRate: 60, pityIncrement: 0, maxSuccessRate: 95, breakthroughFails: 0 });
    expect(r).toBe(60);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- breakthrough.calc`
Expected: FAIL — `bonusPct` ignored / type error.

- [ ] **Step 3: Implement the bonus term**

Replace `computeSuccessRate` in `backend/src/domain/breakthrough/breakthrough.calc.ts`:

```ts
export function computeSuccessRate(params: {
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  breakthroughFails: number;
  // One-shot bonus (percentage points) from a consumed breakthroughBoost pill.
  // Added into the raw rate so it can push toward — but never past — the cap.
  bonusPct?: number;
}): number {
  const raw =
    params.baseSuccessRate +
    params.breakthroughFails * params.pityIncrement +
    (params.bonusPct ?? 0);
  return Math.min(raw, params.maxSuccessRate);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npm test -- breakthrough.calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/breakthrough/breakthrough.calc.ts backend/tests/unit/breakthrough.calc.test.ts
git commit -m "feat(backend): add breakthrough success-rate bonus term"
```

---

### Task 4: Pill entity + applyPillEffect pure logic

**Files:**
- Create: `backend/src/domain/pills/pill.ts`
- Create: `backend/src/domain/pills/pill.calc.ts`
- Create: `backend/tests/unit/pill.calc.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // pill.ts
  type PillEffectKind = 'linhKhi' | 'cultivationBuff' | 'breakthroughBoost' | 'clearPunishment';
  interface PillRecord { id; name; glyph; rarity: number; effectKind: PillEffectKind;
    amount: number | null; multiplier: number | null; durationSec: number | null;
    bonusPct: number | null; desc: string; }
  interface InventoryEntry { pill: PillRecord; quantity: number; }
  // pill.calc.ts
  interface PillEffectResult { linhKhi: number; cultivationBuffMultiplier: number | null;
    cultivationBuffUntil: Date | null; breakthroughBonusPct: number; punishedUntil: Date | null; }
  function applyPillEffect(input: { currentLinhKhi; character: {cultivationBuffMultiplier; cultivationBuffUntil; breakthroughBonusPct; punishedUntil}; pill: PillRecord; now: Date }): PillEffectResult
  ```

- [ ] **Step 1: Create the entity types**

Create `backend/src/domain/pills/pill.ts`:

```ts
export type PillEffectKind =
  | 'linhKhi'
  | 'cultivationBuff'
  | 'breakthroughBoost'
  | 'clearPunishment';

export interface PillRecord {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
}

export interface InventoryEntry {
  pill: PillRecord;
  quantity: number;
}
```

- [ ] **Step 2: Write failing tests for applyPillEffect**

Create `backend/tests/unit/pill.calc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyPillEffect } from '../../src/domain/pills/pill.calc';
import { PillRecord } from '../../src/domain/pills/pill';

const now = new Date('2026-01-01T00:00:00Z');
const charBase = { cultivationBuffMultiplier: null, cultivationBuffUntil: null, breakthroughBonusPct: 0, punishedUntil: null as Date | null };
function pill(over: Partial<PillRecord>): PillRecord {
  return { id: 'p', name: 'p', glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: null, multiplier: null, durationSec: null, bonusPct: null, desc: '', ...over };
}

describe('applyPillEffect', () => {
  it('linhKhi adds amount to current linh khi', () => {
    const r = applyPillEffect({ currentLinhKhi: 100, character: charBase, pill: pill({ effectKind: 'linhKhi', amount: 50 }), now });
    expect(r.linhKhi).toBe(150);
    expect(r.cultivationBuffMultiplier).toBeNull();
  });

  it('cultivationBuff sets multiplier and until = now + durationSec (refresh)', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: charBase, pill: pill({ effectKind: 'cultivationBuff', multiplier: 2, durationSec: 180 }), now });
    expect(r.cultivationBuffMultiplier).toBe(2);
    expect(r.cultivationBuffUntil?.getTime()).toBe(now.getTime() + 180_000);
  });

  it('breakthroughBoost replaces breakthroughBonusPct (not additive)', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: { ...charBase, breakthroughBonusPct: 5 }, pill: pill({ effectKind: 'breakthroughBoost', bonusPct: 15 }), now });
    expect(r.breakthroughBonusPct).toBe(15);
  });

  it('clearPunishment nulls punishedUntil', () => {
    const r = applyPillEffect({ currentLinhKhi: 0, character: { ...charBase, punishedUntil: new Date(now.getTime() + 60_000) }, pill: pill({ effectKind: 'clearPunishment' }), now });
    expect(r.punishedUntil).toBeNull();
  });

  it('preserves unrelated fields (linhKhi effect keeps existing buff/bonus)', () => {
    const existingUntil = new Date(now.getTime() + 90_000);
    const r = applyPillEffect({ currentLinhKhi: 10, character: { cultivationBuffMultiplier: 2, cultivationBuffUntil: existingUntil, breakthroughBonusPct: 7, punishedUntil: null }, pill: pill({ effectKind: 'linhKhi', amount: 5 }), now });
    expect(r.linhKhi).toBe(15);
    expect(r.cultivationBuffMultiplier).toBe(2);
    expect(r.breakthroughBonusPct).toBe(7);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && npm test -- pill.calc`
Expected: FAIL — module missing.

- [ ] **Step 4: Implement applyPillEffect**

Create `backend/src/domain/pills/pill.calc.ts`:

```ts
import { PillRecord } from './pill';

export interface PillEffectResult {
  linhKhi: number;
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
  punishedUntil: Date | null;
}

// Pure translation of "consume this pill" into the character field changes to
// persist. One source of truth shared by ConsumePillUseCase and its tests.
// Starts from the character's current values and mutates only the effect's field.
export function applyPillEffect(input: {
  currentLinhKhi: number;
  character: {
    cultivationBuffMultiplier: number | null;
    cultivationBuffUntil: Date | null;
    breakthroughBonusPct: number;
    punishedUntil: Date | null;
  };
  pill: PillRecord;
  now: Date;
}): PillEffectResult {
  const { character: c, pill, now } = input;
  const result: PillEffectResult = {
    linhKhi: input.currentLinhKhi,
    cultivationBuffMultiplier: c.cultivationBuffMultiplier,
    cultivationBuffUntil: c.cultivationBuffUntil,
    breakthroughBonusPct: c.breakthroughBonusPct,
    punishedUntil: c.punishedUntil,
  };

  switch (pill.effectKind) {
    case 'linhKhi':
      result.linhKhi = input.currentLinhKhi + (pill.amount ?? 0);
      break;
    case 'cultivationBuff':
      // Refresh (one buff at a time): replace multiplier + reset expiry from now.
      result.cultivationBuffMultiplier = pill.multiplier ?? null;
      result.cultivationBuffUntil = new Date(now.getTime() + (pill.durationSec ?? 0) * 1000);
      break;
    case 'breakthroughBoost':
      // Replace, not add — a fresh boost overrides any stale pending one.
      result.breakthroughBonusPct = pill.bonusPct ?? 0;
      break;
    case 'clearPunishment':
      result.punishedUntil = null;
      break;
  }
  return result;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd backend && npm test -- pill.calc`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/pills/ backend/tests/unit/pill.calc.test.ts
git commit -m "feat(backend): add pill entity and applyPillEffect pure logic"
```

---

### Task 5: PillRepository port, in-memory fake, and Prisma implementation

**Files:**
- Create: `backend/src/domain/ports/PillRepository.ts`
- Create: `backend/tests/fakes/InMemoryPillRepository.ts`
- Create: `backend/src/infrastructure/repositories/PrismaPillRepository.ts`
- Test: `backend/tests/integration/PrismaPillRepository.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface PillRepository {
    findById(pillId: string): Promise<PillRecord | null>;
    listInventory(userId: string): Promise<InventoryEntry[]>;
    decrementOne(userId: string, pillId: string): Promise<boolean>;
    seedStarterInventory(userId: string): Promise<void>;
  }
  ```
  `STARTER_INVENTORY: Array<{ pillId: string; quantity: number }>` exported from the port module for reuse by the fake, Prisma repo, and register use case.

- [ ] **Step 1: Define the port**

Create `backend/src/domain/ports/PillRepository.ts`:

```ts
import { PillRecord, InventoryEntry } from '../pills/pill';

// New users start with this inventory (mirrors the frontend mock's seed subset).
export const STARTER_INVENTORY: Array<{ pillId: string; quantity: number }> = [
  { pillId: 'hoi-khi-dan', quantity: 5 },
  { pillId: 'tu-linh-dan', quantity: 3 },
  { pillId: 'cuu-chuyen-kim-dan', quantity: 1 },
  { pillId: 'tinh-tam-dan', quantity: 2 },
  { pillId: 'ngung-than-dan', quantity: 1 },
  { pillId: 'pha-canh-dan', quantity: 2 },
  { pillId: 'thien-cang-dan', quantity: 1 },
  { pillId: 'giai-phat-dan', quantity: 2 },
];

export interface PillRepository {
  findById(pillId: string): Promise<PillRecord | null>;
  listInventory(userId: string): Promise<InventoryEntry[]>;
  // Atomically decrement one unit guarded on quantity > 0. Returns false if the
  // user doesn't own the pill or its quantity is already 0.
  decrementOne(userId: string, pillId: string): Promise<boolean>;
  seedStarterInventory(userId: string): Promise<void>;
}
```

- [ ] **Step 2: Build the in-memory fake**

Create `backend/tests/fakes/InMemoryPillRepository.ts`:

```ts
import { PillRepository, STARTER_INVENTORY } from '../../src/domain/ports/PillRepository';
import { PillRecord, InventoryEntry } from '../../src/domain/pills/pill';

export class InMemoryPillRepository implements PillRepository {
  private pills = new Map<string, PillRecord>();
  // key: `${userId}:${pillId}` -> quantity
  private inv = new Map<string, number>();

  /** Test helper: register a pill definition. */
  seedPill(pill: PillRecord): void {
    this.pills.set(pill.id, pill);
  }

  /** Test helper: set a user's quantity for a pill directly. */
  setQuantity(userId: string, pillId: string, quantity: number): void {
    this.inv.set(`${userId}:${pillId}`, quantity);
  }

  async findById(pillId: string): Promise<PillRecord | null> {
    return this.pills.get(pillId) ?? null;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const out: InventoryEntry[] = [];
    for (const [key, quantity] of this.inv.entries()) {
      const [uid, pillId] = key.split(':');
      if (uid !== userId || quantity <= 0) continue;
      const pill = this.pills.get(pillId);
      if (pill) out.push({ pill, quantity });
    }
    return out;
  }

  async decrementOne(userId: string, pillId: string): Promise<boolean> {
    const key = `${userId}:${pillId}`;
    const q = this.inv.get(key) ?? 0;
    if (q <= 0) return false;
    this.inv.set(key, q - 1);
    return true;
  }

  async seedStarterInventory(userId: string): Promise<void> {
    for (const { pillId, quantity } of STARTER_INVENTORY) {
      this.inv.set(`${userId}:${pillId}`, quantity);
    }
  }
}
```

- [ ] **Step 3: Write failing integration test**

Create `backend/tests/integration/PrismaPillRepository.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPillRepository } from '../../src/infrastructure/repositories/PrismaPillRepository';

const prisma = new PrismaClient();
const repo = new PrismaPillRepository(prisma);

async function makeUser() {
  const user = await prisma.user.create({ data: { username: `pill-${Date.now()}-${Math.random()}`, passwordHash: 'x' } });
  return user.id;
}

describe('PrismaPillRepository', () => {
  beforeAll(async () => {
    const { execSync } = await import('node:child_process');
    execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('seeds starter inventory and lists it', async () => {
    const userId = await makeUser();
    await repo.seedStarterInventory(userId);
    const inv = await repo.listInventory(userId);
    expect(inv.length).toBe(8);
    const hoiKhi = inv.find((e) => e.pill.id === 'hoi-khi-dan');
    expect(hoiKhi?.quantity).toBe(5);
  });

  it('decrementOne succeeds while quantity > 0 and fails at 0', async () => {
    const userId = await makeUser();
    await prisma.inventoryItem.create({ data: { userId, pillId: 'giai-phat-dan', quantity: 1 } });
    expect(await repo.decrementOne(userId, 'giai-phat-dan')).toBe(true);
    expect(await repo.decrementOne(userId, 'giai-phat-dan')).toBe(false);
  });

  it('decrementOne is atomic under a concurrent race (only quantity-many succeed)', async () => {
    const userId = await makeUser();
    await prisma.inventoryItem.create({ data: { userId, pillId: 'hoi-khi-dan', quantity: 3 } });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => repo.decrementOne(userId, 'hoi-khi-dan')),
    );
    expect(results.filter(Boolean).length).toBe(3);
    const row = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId, pillId: 'hoi-khi-dan' } } });
    expect(row?.quantity).toBe(0);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `cd backend && npm test -- PrismaPillRepository`
Expected: FAIL — module missing.

- [ ] **Step 5: Implement the Prisma repository**

Create `backend/src/infrastructure/repositories/PrismaPillRepository.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { PillRepository, STARTER_INVENTORY } from '../../domain/ports/PillRepository';
import { PillRecord, InventoryEntry, PillEffectKind } from '../../domain/pills/pill';

// Prisma stores effectKind as a plain string column; narrow it back to the
// domain union at the boundary (the seed only ever writes valid kinds).
function toPillRecord(row: {
  id: string; name: string; glyph: string; rarity: number; effectKind: string;
  amount: number | null; multiplier: number | null; durationSec: number | null;
  bonusPct: number | null; desc: string;
}): PillRecord {
  return { ...row, effectKind: row.effectKind as PillEffectKind };
}

export class PrismaPillRepository implements PillRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(pillId: string): Promise<PillRecord | null> {
    const row = await this.client.pill.findUnique({ where: { id: pillId } });
    return row ? toPillRecord(row) : null;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const items = await this.client.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { pill: true },
    });
    return items.map((it) => ({ pill: toPillRecord(it.pill), quantity: it.quantity }));
  }

  async decrementOne(userId: string, pillId: string): Promise<boolean> {
    // Row-level atomic guard: only decrements when the row exists AND quantity>0.
    // Two concurrent calls can't both drive one unit negative — the DB serializes
    // the conditional updates and count reflects how many actually matched.
    const result = await this.client.inventoryItem.updateMany({
      where: { userId, pillId, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
    return result.count === 1;
  }

  async seedStarterInventory(userId: string): Promise<void> {
    await this.client.inventoryItem.createMany({
      data: STARTER_INVENTORY.map((s) => ({ userId, pillId: s.pillId, quantity: s.quantity })),
      skipDuplicates: true,
    });
  }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `cd backend && npm test -- PrismaPillRepository`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/domain/ports/PillRepository.ts backend/tests/fakes/InMemoryPillRepository.ts backend/src/infrastructure/repositories/PrismaPillRepository.ts backend/tests/integration/PrismaPillRepository.test.ts
git commit -m "feat(backend): add PillRepository port, fake, and Prisma implementation"
```

---

### Task 6: Extend CharacterRepository update input with buff/bonus fields

**Files:**
- Modify: `backend/src/domain/ports/CharacterRepository.ts`
- Modify: `backend/src/domain/entities/Character.ts`
- Modify: `backend/src/infrastructure/repositories/PrismaCharacterRepository.ts`
- Modify: `backend/tests/fakes/InMemoryCharacterRepository.ts`

**Interfaces:**
- Produces: `CharacterRecord` and `CharacterUpdateInput` gain `cultivationBuffMultiplier: number | null`, `cultivationBuffUntil: Date | null`, `breakthroughBonusPct: number`.

- [ ] **Step 1: Add fields to the entity**

In `backend/src/domain/entities/Character.ts`, add to `CharacterRecord` (after `punishedUntil`):

```ts
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
```

- [ ] **Step 2: Add fields to the update input**

In `backend/src/domain/ports/CharacterRepository.ts`, add to `CharacterUpdateInput`:

```ts
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
```

- [ ] **Step 3: Update the in-memory fake's default seed**

The fake's `updateWithConcurrencyGuard` already spreads `...data`, so it needs no change. But any test helper `makeCharacter` in existing tests must still compile — the entity now has three new required fields. Update `backend/tests/fakes/InMemoryCharacterRepository.ts` only if it constructs a `CharacterRecord` literal (it does not — it only stores what it's given). No change needed here; the `makeCharacter` helpers live in test files (updated in Task 9). Confirm by reading the fake.

- [ ] **Step 4: Verify Prisma repo passes the fields through**

`PrismaCharacterRepository.updateWithConcurrencyGuard` passes `data` straight to `updateMany`, and `findByUserId`/`findUniqueOrThrow` return the full row (now including the new columns). Prisma's generated types will include the new fields automatically after Task 1's `prisma generate`. No code change is required, but confirm the file still typechecks against the new `CharacterUpdateInput`.

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: errors ONLY in existing call sites that build `CharacterUpdateInput`/`CharacterRecord` literals without the new fields (fixed in Tasks 8–9) and the two use cases (Task 9). If `PrismaCharacterRepository.ts` itself errors, fix it here; if only application/test files error, leave them for their tasks.

Note: because this task intentionally leaves the tree not-yet-compiling (callers updated in later tasks), commit it together with Task 9 OR add the carry-through to `AttemptBreakthroughUseCase` now. To keep each task green, **defer the commit**: proceed directly to Task 7–9 and run the full typecheck at the end of Task 9, committing Tasks 6+9 together. (Tasks 7–8 add new files that already set the fields.)

- [ ] **Step 6: (Deferred) commit with Task 9**

---

### Task 7: GetInventoryUseCase

**Files:**
- Create: `backend/src/application/GetInventoryUseCase.ts`
- Create: `backend/tests/unit/GetInventoryUseCase.test.ts`

**Interfaces:**
- Consumes: `PillRepository`, `InventoryEntry`.
- Produces: `GetInventoryUseCase.execute(userId): Promise<InventoryDto[]>` where `InventoryDto = { id, name, glyph, rarity, effectKind, amount, multiplier, durationSec, bonusPct, desc, quantity }`.

- [ ] **Step 1: Write failing test**

Create `backend/tests/unit/GetInventoryUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GetInventoryUseCase } from '../../src/application/GetInventoryUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', ...over };
}

describe('GetInventoryUseCase', () => {
  it('returns owned pills flattened with quantity', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    pills.seedPill(pill('b', { rarity: 2 }));
    pills.setQuantity('user-1', 'a', 3);
    pills.setQuantity('user-1', 'b', 1);
    const out = await new GetInventoryUseCase(pills).execute('user-1');
    const a = out.find((p) => p.id === 'a');
    expect(a).toMatchObject({ id: 'a', quantity: 3, effectKind: 'linhKhi', amount: 10 });
    expect(out.length).toBe(2);
  });

  it('returns an empty array for a user with no pills', async () => {
    const out = await new GetInventoryUseCase(new InMemoryPillRepository()).execute('nobody');
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- GetInventoryUseCase`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `backend/src/application/GetInventoryUseCase.ts`:

```ts
import { PillRepository } from '../domain/ports/PillRepository';
import { PillEffectKind } from '../domain/pills/pill';

export interface InventoryDto {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  quantity: number;
}

export class GetInventoryUseCase {
  constructor(private readonly pills: PillRepository) {}

  async execute(userId: string): Promise<InventoryDto[]> {
    const entries = await this.pills.listInventory(userId);
    return entries.map((e) => ({
      id: e.pill.id,
      name: e.pill.name,
      glyph: e.pill.glyph,
      rarity: e.pill.rarity,
      effectKind: e.pill.effectKind,
      amount: e.pill.amount,
      multiplier: e.pill.multiplier,
      durationSec: e.pill.durationSec,
      bonusPct: e.pill.bonusPct,
      desc: e.pill.desc,
      quantity: e.quantity,
    }));
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npm test -- GetInventoryUseCase`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/GetInventoryUseCase.ts backend/tests/unit/GetInventoryUseCase.test.ts
git commit -m "feat(backend): add GetInventoryUseCase"
```

---

### Task 8: ConsumePillUseCase

**Files:**
- Create: `backend/src/application/ConsumePillUseCase.ts`
- Create: `backend/tests/unit/ConsumePillUseCase.test.ts`

**Interfaces:**
- Consumes: `CharacterRepository`, `PillRepository`, `applyPillEffect`, `computeLinhKhi`, `REALMS`/`MAX_REALM_MAJOR`, `isMaxStage`, `DomainError`.
- Produces: `ConsumePillUseCase.execute(userId, pillId): Promise<CultivationStateOutput>` (reuses the state DTO shape from `GetCultivationStateUseCase`). New error codes: `PILL_NOT_FOUND`, `PILL_OUT_OF_STOCK`, `PILL_NOT_APPLICABLE`.

- [ ] **Step 1: Write failing tests**

Create `backend/tests/unit/ConsumePillUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ConsumePillUseCase } from '../../src/application/ConsumePillUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { CharacterRecord } from '../../src/domain/entities/Character';
import { PillRecord } from '../../src/domain/pills/pill';

function makeCharacter(over: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1', userId: 'user-1', realmMajor: 0, realmSub: 0, linhKhi: 0,
    lastUpdateAt: new Date(), breakthroughFails: 0, punishedUntil: null, createdAt: new Date(),
    cultivationBuffMultiplier: null, cultivationBuffUntil: null, breakthroughBonusPct: 0, ...over,
  };
}
function pill(id: string, over: Partial<PillRecord>): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: null, multiplier: null, durationSec: null, bonusPct: null, desc: '', ...over };
}
function setup(charOver: Partial<CharacterRecord> = {}) {
  const characters = new InMemoryCharacterRepository();
  characters.seed(makeCharacter(charOver));
  const pills = new InMemoryPillRepository();
  return { characters, pills, useCase: new ConsumePillUseCase(characters, pills) };
}

describe('ConsumePillUseCase', () => {
  it('linhKhi pill adds linh khi and decrements inventory', async () => {
    const { characters, pills, useCase } = setup({ linhKhi: 10 });
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 2);

    const state = await useCase.execute('user-1', 'a');
    expect(state.linhKhi).toBeGreaterThanOrEqual(110);
    const saved = await characters.findByUserId('user-1');
    expect(saved?.linhKhi).toBeGreaterThanOrEqual(110);
    const inv = await pills.listInventory('user-1');
    expect(inv.find((e) => e.pill.id === 'a')?.quantity).toBe(1);
  });

  it('cultivationBuff pill sets buff multiplier and expiry', async () => {
    const { characters, pills, useCase } = setup();
    pills.seedPill(pill('b', { effectKind: 'cultivationBuff', multiplier: 2, durationSec: 60 }));
    pills.setQuantity('user-1', 'b', 1);
    await useCase.execute('user-1', 'b');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.cultivationBuffMultiplier).toBe(2);
    expect(saved?.cultivationBuffUntil).not.toBeNull();
  });

  it('breakthroughBoost pill sets breakthroughBonusPct', async () => {
    const { characters, pills, useCase } = setup();
    pills.seedPill(pill('c', { effectKind: 'breakthroughBoost', bonusPct: 15 }));
    pills.setQuantity('user-1', 'c', 1);
    await useCase.execute('user-1', 'c');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.breakthroughBonusPct).toBe(15);
  });

  it('clearPunishment pill clears punishedUntil', async () => {
    const { characters, pills, useCase } = setup({ punishedUntil: new Date(Date.now() + 60_000) });
    pills.seedPill(pill('d', { effectKind: 'clearPunishment' }));
    pills.setQuantity('user-1', 'd', 1);
    await useCase.execute('user-1', 'd');
    const saved = await characters.findByUserId('user-1');
    expect(saved?.punishedUntil).toBeNull();
  });

  it('rejects clearPunishment when not punished (PILL_NOT_APPLICABLE)', async () => {
    const { pills, useCase } = setup({ punishedUntil: null });
    pills.seedPill(pill('d', { effectKind: 'clearPunishment' }));
    pills.setQuantity('user-1', 'd', 1);
    await expect(useCase.execute('user-1', 'd')).rejects.toMatchObject({ code: 'PILL_NOT_APPLICABLE' });
  });

  it('rejects linhKhi/boost at max stage (PILL_NOT_APPLICABLE)', async () => {
    const { pills, useCase } = setup({ realmMajor: 11, realmSub: 3 });
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 1);
    await expect(useCase.execute('user-1', 'a')).rejects.toMatchObject({ code: 'PILL_NOT_APPLICABLE' });
  });

  it('rejects an unknown pill (PILL_NOT_FOUND)', async () => {
    const { useCase } = setup();
    await expect(useCase.execute('user-1', 'nope')).rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });

  it('rejects when out of stock (PILL_OUT_OF_STOCK)', async () => {
    const { pills, useCase } = setup();
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('user-1', 'a', 0);
    await expect(useCase.execute('user-1', 'a')).rejects.toMatchObject({ code: 'PILL_OUT_OF_STOCK' });
  });

  it('rejects an unknown user (CHARACTER_NOT_FOUND)', async () => {
    const { pills, useCase } = setup();
    pills.seedPill(pill('a', { effectKind: 'linhKhi', amount: 100 }));
    pills.setQuantity('nobody', 'a', 1);
    await expect(useCase.execute('nobody', 'a')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- ConsumePillUseCase`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `backend/src/application/ConsumePillUseCase.ts`:

```ts
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../infrastructure/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { isMaxStage } from '../domain/breakthrough/breakthrough.calc';
import { applyPillEffect } from '../domain/pills/pill.calc';
import { CultivationStateOutput } from './GetCultivationStateUseCase';

export class ConsumePillUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly pills: PillRepository,
  ) {}

  async execute(userId: string, pillId: string): Promise<CultivationStateOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }
    const pill = await this.pills.findById(pillId);
    if (!pill) {
      throw new DomainError('PILL_NOT_FOUND', 'Pill not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
    const now = new Date();
    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);
    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();

    // Applicability guards (before spending the pill): a pill that can't do
    // anything must not be consumed.
    if (pill.effectKind === 'clearPunishment' && !punished) {
      throw new DomainError('PILL_NOT_APPLICABLE', 'Not currently punished');
    }
    if ((pill.effectKind === 'linhKhi' || pill.effectKind === 'breakthroughBoost') && atMax) {
      throw new DomainError('PILL_NOT_APPLICABLE', 'Already at the maximum realm');
    }

    // Recompute lazily-accrued linh khi (respecting any active buff) up front.
    const buff =
      character.cultivationBuffMultiplier !== null && character.cultivationBuffUntil !== null
        ? { multiplier: character.cultivationBuffMultiplier, until: character.cultivationBuffUntil }
        : undefined;
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
      buff,
    });

    // Spend the pill FIRST. decrementOne is a row-level atomic guard, so two
    // concurrent consumes of the last unit can't both proceed — the loser gets
    // false here and never applies the effect.
    const decremented = await this.pills.decrementOne(userId, pillId);
    if (!decremented) {
      throw new DomainError('PILL_OUT_OF_STOCK', 'No units of this pill remaining');
    }

    const effect = applyPillEffect({ currentLinhKhi, character, pill, now });

    // Persist via the optimistic-concurrency guard, carrying every field.
    const updated = await this.characters.updateWithConcurrencyGuard(character.id, character.lastUpdateAt, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      linhKhi: effect.linhKhi,
      lastUpdateAt: now,
      breakthroughFails: character.breakthroughFails,
      punishedUntil: effect.punishedUntil,
      cultivationBuffMultiplier: effect.cultivationBuffMultiplier,
      cultivationBuffUntil: effect.cultivationBuffUntil,
      breakthroughBonusPct: effect.breakthroughBonusPct,
    });
    if (!updated) {
      throw new DomainError('CONCURRENT_MODIFICATION', 'Character was modified by another request');
    }

    // Return the fresh cultivation state (same shape GET /cultivation/state uses).
    const newStage = REALMS[updated.realmMajor].subStages[updated.realmSub];
    const newAtMax = isMaxStage(updated.realmMajor, updated.realmSub, MAX_REALM_MAJOR);
    const newPunished = updated.punishedUntil !== null && updated.punishedUntil.getTime() > now.getTime();
    return {
      realmMajor: updated.realmMajor,
      realmSub: updated.realmSub,
      realmName: `${REALMS[updated.realmMajor].name} - ${newStage.name}`,
      linhKhi: updated.linhKhi,
      linhKhiRequired: newStage.linhKhiRequired,
      canBreakthrough: !newAtMax && !newPunished && updated.linhKhi >= newStage.linhKhiRequired,
      isMaxStage: newAtMax,
      punishedUntil: updated.punishedUntil,
      cultivationRate: newStage.cultivationRate,
    };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npm test -- ConsumePillUseCase`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/ConsumePillUseCase.ts backend/tests/unit/ConsumePillUseCase.test.ts
git commit -m "feat(backend): add ConsumePillUseCase with applicability and stock guards"
```

---

### Task 9: AttemptBreakthroughUseCase — buffed accrual + bonus apply/reset

**Files:**
- Modify: `backend/src/application/AttemptBreakthroughUseCase.ts`
- Modify: `backend/tests/unit/AttemptBreakthroughUseCase.test.ts`
- Modify: `backend/tests/unit/GetCultivationStateUseCase.test.ts` (makeCharacter helper new fields)
- Modify: any other unit test that builds a `CharacterRecord` literal.

**Interfaces:**
- Consumes: `character.breakthroughBonusPct`, active buff fields.
- Produces: breakthrough uses buffed accrual + bonus; resets `breakthroughBonusPct` to 0 on every resolved attempt; carries buff fields through all `persist` calls.

- [ ] **Step 1: Update the persist signature + buffed accrual + bonus**

In `backend/src/application/AttemptBreakthroughUseCase.ts`:

Add buffed accrual — replace the `computeLinhKhi` call:

```ts
    const buff =
      character.cultivationBuffMultiplier !== null && character.cultivationBuffUntil !== null
        ? { multiplier: character.cultivationBuffMultiplier, until: character.cultivationBuffUntil }
        : undefined;
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
      buff,
    });
```

Add the bonus to the success rate — replace the `computeSuccessRate` call:

```ts
    const successRate = computeSuccessRate({
      baseSuccessRate: stage.baseSuccessRate,
      pityIncrement: stage.pityIncrement,
      maxSuccessRate: stage.maxSuccessRate,
      breakthroughFails: character.breakthroughFails,
      bonusPct: character.breakthroughBonusPct,
    });
```

Update the `persist` helper's `rest` type and body to carry the three new fields. Change the signature:

```ts
  private async persist(
    original: CharacterRecord,
    linhKhi: number,
    lastUpdateAt: Date,
    rest: {
      realmMajor: number; realmSub: number; breakthroughFails: number; punishedUntil: Date | null;
      cultivationBuffMultiplier: number | null; cultivationBuffUntil: Date | null; breakthroughBonusPct: number;
    },
  ): Promise<CharacterRecord> {
    const updated = await this.characters.updateWithConcurrencyGuard(original.id, original.lastUpdateAt, {
      linhKhi, lastUpdateAt, ...rest,
    });
    if (!updated) {
      throw new DomainError('CONCURRENT_MODIFICATION', 'Character was modified by another request');
    }
    return updated;
  }
```

Now update EACH of the five `persist(...)` call sites. The three **rejection** paths (max, punished, insufficient) carry the existing buff/bonus UNCHANGED (the attempt never rolled):

```ts
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: character.breakthroughBonusPct,
      });
```

The **success** path resets the bonus to 0 (used) and carries the buff forward:

```ts
      const updated = await this.persist(character, currentLinhKhi - stage.linhKhiRequired, now, {
        realmMajor,
        realmSub,
        breakthroughFails: 0,
        punishedUntil: null,
        cultivationBuffMultiplier: character.cultivationBuffMultiplier,
        cultivationBuffUntil: character.cultivationBuffUntil,
        breakthroughBonusPct: 0,
      });
```

The **failure** path also resets the bonus to 0 (used) and carries the buff:

```ts
    const updated = await this.persist(character, currentLinhKhi, now, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      breakthroughFails: character.breakthroughFails + 1,
      punishedUntil: new Date(now.getTime() + stage.punishmentSeconds * 1000),
      cultivationBuffMultiplier: character.cultivationBuffMultiplier,
      cultivationBuffUntil: character.cultivationBuffUntil,
      breakthroughBonusPct: 0,
    });
```

- [ ] **Step 2: Update all makeCharacter helpers and update-input literals**

In `backend/tests/unit/AttemptBreakthroughUseCase.test.ts` and `backend/tests/unit/GetCultivationStateUseCase.test.ts` (the only two files with a `makeCharacter` `CharacterRecord` literal), add to the returned object:

```ts
    cultivationBuffMultiplier: null,
    cultivationBuffUntil: null,
    breakthroughBonusPct: 0,
```

Also update `backend/tests/integration/PrismaCharacterRepository.test.ts`: it builds three `CharacterUpdateInput` literals (the `updateWithConcurrencyGuard` call sites). Add the same three fields to each `data` object:

```ts
      cultivationBuffMultiplier: null,
      cultivationBuffUntil: null,
      breakthroughBonusPct: 0,
```

- [ ] **Step 3: Add new breakthrough-bonus tests**

Append to `backend/tests/unit/AttemptBreakthroughUseCase.test.ts`:

```ts
describe('AttemptBreakthroughUseCase breakthrough bonus', () => {
  it('applies breakthroughBonusPct and resets it to 0 on success', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughBonusPct: 30 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));
    const result = await useCase.execute('user-1');
    expect(result.success).toBe(true);
    expect(result.character.breakthroughBonusPct).toBe(0);
  });

  it('resets breakthroughBonusPct to 0 on failure too', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughBonusPct: 10 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0.999));
    const result = await useCase.execute('user-1');
    expect(result.success).toBe(false);
    expect(result.character.breakthroughBonusPct).toBe(0);
  });

  it('leaves breakthroughBonusPct untouched on a rejected attempt (insufficient)', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 10, breakthroughBonusPct: 25 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));
    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_KHI' });
    const saved = await characters.findByUserId('user-1');
    expect(saved?.breakthroughBonusPct).toBe(25);
  });
});
```

- [ ] **Step 4: Typecheck + run the whole suite**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: typecheck clean; all unit + integration tests pass.

- [ ] **Step 5: Commit (includes Task 6's deferred changes)**

```bash
git add backend/src/domain/entities/Character.ts backend/src/domain/ports/CharacterRepository.ts backend/src/application/AttemptBreakthroughUseCase.ts backend/tests/unit/AttemptBreakthroughUseCase.test.ts backend/tests/unit/GetCultivationStateUseCase.test.ts backend/tests/integration/PrismaCharacterRepository.test.ts
git commit -m "feat(backend): apply/reset breakthrough bonus and buffed accrual in breakthrough"
```

---

### Task 10: Seed starter inventory on registration

**Files:**
- Modify: `backend/src/application/RegisterUserUseCase.ts`
- Modify: `backend/tests/unit/RegisterUserUseCase.test.ts`

**Interfaces:**
- Consumes: `PillRepository.seedStarterInventory`.
- Produces: `RegisterUserUseCase` constructor gains a `PillRepository` param; after creating the character it seeds starter inventory.

- [ ] **Step 1: Read the current RegisterUserUseCase**

Read `backend/src/application/RegisterUserUseCase.ts`. It creates the user via `this.users.create(...)` (which nested-creates the default Character inside `PrismaUserRepository`), signs tokens, and returns `{ id, username, accessToken, refreshToken }`. The starter inventory is seeded off the returned `user.id` — the use case never touches the Character directly.

- [ ] **Step 2: Write/adjust failing test**

In `backend/tests/unit/RegisterUserUseCase.test.ts`, add an `InMemoryPillRepository` to the setup and assert seeding. Add:

```ts
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
// ...in the test's arrange, construct: new RegisterUserUseCase(users, hasher, tokenService, pills)
it('seeds starter inventory for the new user', async () => {
  const pills = new InMemoryPillRepository();
  // (construct useCase with pills per the updated signature)
  // ...register a user, capture its id from the output...
  const inv = await pills.listInventory(output.id);
  expect(inv.length).toBe(8);
});
```

(Match the existing test's construction style; thread `pills` as the new final constructor arg into every `new RegisterUserUseCase(...)` in the file.)

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && npm test -- RegisterUserUseCase`
Expected: FAIL — constructor arity / seeding assertion.

- [ ] **Step 4: Implement**

In `backend/src/application/RegisterUserUseCase.ts`, add the `PillRepository` as the last constructor parameter (after `tokenService`), and after `const user = await this.users.create(...)` (which nested-creates the default Character), call `await this.pills.seedStarterInventory(user.id)` before signing tokens / returning. Add the import:

```ts
import { PillRepository } from '../domain/ports/PillRepository';
```

- [ ] **Step 5: Run to verify pass**

Run: `cd backend && npm test -- RegisterUserUseCase`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/application/RegisterUserUseCase.ts backend/tests/unit/RegisterUserUseCase.test.ts
git commit -m "feat(backend): seed starter pill inventory on registration"
```

---

### Task 11: Routes, request schema, error mappings, and app wiring

**Files:**
- Create: `backend/src/presentation/routes/pills.routes.ts`
- Create: `backend/src/presentation/schemas/pills.schemas.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/pills.routes.test.ts`

**Interfaces:**
- Produces: `GET /pills/inventory`, `POST /pills/consume`; error codes `PILL_NOT_FOUND` 404, `PILL_OUT_OF_STOCK` 409, `PILL_NOT_APPLICABLE` 400.

- [ ] **Step 1: Add error-code mappings**

In `backend/src/presentation/middleware/errorHandler.ts`, add to `STATUS_BY_CODE`:

```ts
  PILL_NOT_FOUND: 404,
  PILL_OUT_OF_STOCK: 409,
  PILL_NOT_APPLICABLE: 400,
```

- [ ] **Step 2: Add the zod request schema**

Create `backend/src/presentation/schemas/pills.schemas.ts` (match the style of `auth.schemas.ts` — read it first for the exact zod import + parse pattern):

```ts
import { z } from 'zod';

export const consumePillSchema = z.object({
  pillId: z.string().min(1),
});
```

- [ ] **Step 3: Create the router**

Create `backend/src/presentation/routes/pills.routes.ts`:

```ts
import { Router, RequestHandler } from 'express';
import { GetInventoryUseCase } from '../../application/GetInventoryUseCase';
import { ConsumePillUseCase } from '../../application/ConsumePillUseCase';
import { AuthedRequest } from '../middleware/auth';
import { consumePillSchema } from '../schemas/pills.schemas';
import { DomainError } from '../../domain/errors';

export interface PillsRouterDeps {
  getInventoryUseCase: GetInventoryUseCase;
  consumePillUseCase: ConsumePillUseCase;
  requireAuth: RequestHandler;
}

export function createPillsRouter(deps: PillsRouterDeps): Router {
  const router = Router();

  router.get('/inventory', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const inventory = await deps.getInventoryUseCase.execute(req.userId as string);
      res.status(200).json(inventory);
    } catch (err) {
      next(err);
    }
  });

  router.post('/consume', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const parsed = consumePillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'pillId is required');
      }
      const state = await deps.consumePillUseCase.execute(req.userId as string, parsed.data.pillId);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Wire into app.ts**

In `backend/src/app.ts`:
- import `PrismaPillRepository`, `GetInventoryUseCase`, `ConsumePillUseCase`, `createPillsRouter`.
- construct `const pillRepository = new PrismaPillRepository(client);`
- pass `pillRepository` as the new final arg to `new RegisterUserUseCase(userRepository, passwordHasher, tokenService, pillRepository)`.
- construct the two use cases:
  ```ts
  const getInventoryUseCase = new GetInventoryUseCase(pillRepository);
  const consumePillUseCase = new ConsumePillUseCase(characterRepository, pillRepository);
  ```
- mount the router after the cultivation router:
  ```ts
  app.use('/pills', createPillsRouter({ getInventoryUseCase, consumePillUseCase, requireAuth }));
  ```

- [ ] **Step 5: Write integration test**

Create `backend/tests/integration/pills.routes.test.ts` (match `auth.routes.test.ts` for supertest + app + cookie-jar setup — read it first). Cover:

```ts
// pseudocode structure; mirror auth.routes.test.ts's exact helpers
describe('pills routes', () => {
  // beforeAll: run `npm run db:seed`
  it('GET /pills/inventory returns the starter inventory after register', async () => {
    // register -> capture cookies -> GET /pills/inventory with cookie
    // expect 200, body length 8, an entry { id: 'hoi-khi-dan', quantity: 5 }
  });

  it('POST /pills/consume applies linhKhi and returns updated state', async () => {
    // register -> POST /pills/consume { pillId: 'hoi-khi-dan' }
    // expect 200, body has linhKhi/linhKhiRequired; inventory now shows quantity 4
  });

  it('POST /pills/consume of a not-punished clearPunishment pill -> 400 PILL_NOT_APPLICABLE', async () => {
    // register -> consume 'giai-phat-dan' -> 400 { error: { code: 'PILL_NOT_APPLICABLE' } }
  });

  it('consuming to zero then once more -> 409 PILL_OUT_OF_STOCK', async () => {
    // register -> consume 'cuu-chuyen-kim-dan' (qty 1) once (200) then again -> 409
  });

  it('POST /pills/consume without auth -> 401', async () => {
    // no cookie -> 401
  });
});
```

Fill each block with the concrete supertest calls following `auth.routes.test.ts`'s cookie handling.

- [ ] **Step 6: Run to verify pass**

Run: `cd backend && npx tsc --noEmit && npm test -- pills.routes`
Expected: typecheck clean; PASS (5 tests). Then full `npm test` green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/presentation/routes/pills.routes.ts backend/src/presentation/schemas/pills.schemas.ts backend/src/presentation/middleware/errorHandler.ts backend/src/app.ts backend/tests/integration/pills.routes.test.ts
git commit -m "feat(backend): add pills routes, request schema, and app wiring"
```

---

### Task 12: Manual verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full suite**

Run: `cd backend && npm test`
Expected: all unit + integration tests green.

- [ ] **Step 2: Manual cookie-jar pass against Docker Postgres**

```bash
cd backend && docker compose up -d --build
# after boot, the api container should run migrate + seed; if not, exec the seed:
docker compose exec api npm run db:seed
```

With `curl -c jar -b jar` against `http://localhost:5000`:
- register a new user → 200, cookies set.
- `GET /pills/inventory` (cookie only) → 8 entries incl. `hoi-khi-dan` ×5.
- `POST /pills/consume {"pillId":"hoi-khi-dan"}` → 200, `linhKhi` bumped; re-GET inventory shows ×4.
- `POST /pills/consume {"pillId":"tinh-tam-dan"}` → 200; `GET /cultivation/state` a few seconds later shows faster-than-base accrual (buffed), confirming piecewise integration.
- `POST /pills/consume {"pillId":"pha-canh-dan"}` → 200; the bonus is applied on the next `POST /cultivation/breakthrough` and gone afterward.
- `POST /pills/consume {"pillId":"giai-phat-dan"}` when not punished → 400 `PILL_NOT_APPLICABLE`.
- consume `cuu-chuyen-kim-dan` (×1) twice → second is 409 `PILL_OUT_OF_STOCK`.

- [ ] **Step 3: Update CLAUDE.md**

Append a "Phase 4: Backend Đan Dược" section to `CLAUDE.md` summarizing: new `Pill`/`InventoryItem` models + Character buff/bonus fields (migration `dan_duoc`, seed `prisma/seed.ts`, `npm run db:seed`); `domain/pills/` (`pill.ts`, `pill.calc.ts`); `PillRepository` port + `PrismaPillRepository` (atomic `decrementOne`) + `InMemoryPillRepository` fake; `GetInventoryUseCase`/`ConsumePillUseCase`; piecewise cultivation-buff accrual in `computeLinhKhi`; `breakthroughBonusPct` applied + reset in `AttemptBreakthroughUseCase`; starter inventory seeded on registration; routes `GET /pills/inventory`, `POST /pills/consume`; new error codes `PILL_NOT_FOUND` 404 / `PILL_OUT_OF_STOCK` 409 / `PILL_NOT_APPLICABLE` 400. Note the frontend still uses its mock (`use-pill-inventory`); wiring is a future task. Reference the spec `docs/superpowers/specs/2026-07-18-dan-duoc-backend-design.md`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note backend đan dược feature in CLAUDE.md"
```
