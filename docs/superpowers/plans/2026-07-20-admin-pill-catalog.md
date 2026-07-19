# Admin Pill Catalog Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin CRUD for the pill (đan dược) catalog at runtime — create/edit/soft-disable pills and tune starter-inventory grants from `/admin/pills` — replacing seed-file edits.

**Architecture:** Two new columns on `Pill` (`active`, `starterQuantity`); per-pill CRUD endpoints (`GET/POST /admin/pills`, `PUT /admin/pills/:id`) behind the existing `requireAuth + requireAdmin`; a pure domain validator (`validatePillDefinition`); registration seeds starter inventory from the DB instead of a hardcoded constant. Frontend gets a flat card-list editor page with per-pill draft state. No provider/cache layer — pills are read from the DB per request, so writes are live immediately.

**Tech Stack:** Backend: Express 4, Prisma 5, zod, Vitest 2 + supertest (integration tests hit real Postgres via Docker). Frontend: Next.js 16 App Router, React 19, Vitest (node env, pure logic only).

**Spec:** `docs/superpowers/specs/2026-07-20-admin-pill-catalog-design.md` — read it first.

## Global Constraints

- Branch: `feat/admin-pills` from `main` (Task 1 creates it).
- Clean Architecture (CLAUDE.md Mandatory Rule): `domain/` has zero framework deps; `application/` depends only on domain ports; HTTP status mapping lives ONLY in `errorHandler`.
- Comment non-trivial logic with the *why* (CLAUDE.md Mandatory Rule).
- Before using any library API (Prisma, zod, Express, Next.js), cross-check with `ctx7` CLI against the pinned version (CLAUDE.md Mandatory Rule).
- `Pill.id` is immutable after creation — update routes take id from the URL, never the body.
- Players must not be able to distinguish a disabled pill from a nonexistent one: both are `PILL_NOT_FOUND` 404 on consume; disabled pills are silently omitted from `GET /pills/inventory`.
- The player inventory DTO (`InventoryDto` / frontend `PillInventoryItem`) must NOT gain `active`/`starterQuantity` — it maps fields explicitly; leave it as is.
- Backend tests: `cd backend && npm test` (needs `docker compose up -d` Postgres). Suite currently at 182 tests — must stay green throughout.
- Frontend gate: `cd frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build`. Currently 41 tests.
- Error codes added this feature: `INVALID_PILL_CONFIG` → 400, `PILL_ID_TAKEN` → 409.
- Commit messages: no Co-Authored-By trailer (project convention).

---

### Task 1: Branch, schema migration, domain type, seed

**Files:**
- Modify: `backend/prisma/schema.prisma` (Pill model)
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/src/domain/pills/pill.ts` (`PillRecord`)
- Modify: `backend/src/infrastructure/repositories/PrismaPillRepository.ts` (`toPillRecord` param type)
- Modify: `backend/tests/fakes/InMemoryPillRepository.ts` (`seedStarterDefinitions`)
- Modify: `backend/tests/unit/ConsumePillUseCase.test.ts` (pill() helper)
- Modify: `backend/tests/unit/GetInventoryUseCase.test.ts` (pill() helper)
- Test: `backend/tests/integration/pills-schema.test.ts`

**Interfaces:**
- Produces: `PillRecord` now has `active: boolean` and `starterQuantity: number` (both required). `Pill` table has `active Boolean @default(true)`, `starterQuantity Int @default(0)`. Seeded pills carry today's starter quantities (hoi-khi-dan 5, tu-linh-dan 3, cuu-chuyen-kim-dan 1, tinh-tam-dan 2, ngung-than-dan 1, pha-canh-dan 2, thien-cang-dan 1, giai-phat-dan 2) and `active: true`.

- [ ] **Step 1: Create the branch**

```bash
cd /home/hayashi/working/tu-tien-chi-lo
git checkout main && git pull && git checkout -b feat/admin-pills
```

- [ ] **Step 2: Ensure Postgres is up**

```bash
cd backend && docker compose up -d
```

- [ ] **Step 3: Write the failing test** — append to `backend/tests/integration/pills-schema.test.ts` inside the existing `describe('pills schema + seed', ...)`:

```typescript
  it('seeds active + starterQuantity on every pill (old STARTER_INVENTORY values)', async () => {
    const expected: Record<string, number> = {
      'hoi-khi-dan': 5, 'tu-linh-dan': 3, 'cuu-chuyen-kim-dan': 1, 'tinh-tam-dan': 2,
      'ngung-than-dan': 1, 'pha-canh-dan': 2, 'thien-cang-dan': 1, 'giai-phat-dan': 2,
    };
    for (const [id, qty] of Object.entries(expected)) {
      const p = await prisma.pill.findUnique({ where: { id } });
      expect(p?.active).toBe(true);
      expect(p?.starterQuantity).toBe(qty);
    }
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/integration/pills-schema.test.ts`
Expected: FAIL — TypeScript error `Property 'active' does not exist` (the Prisma client has no such column yet).

- [ ] **Step 5: Edit the schema** — in `backend/prisma/schema.prisma`, replace the `Pill` model with:

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
  // Soft-disable: an inactive pill is hidden from player inventories and cannot
  // be consumed, but InventoryItem rows survive — re-enabling restores holdings.
  active      Boolean         @default(true)
  // Quantity granted to a newly registered user (0 = not part of the starter kit).
  // Replaces the old hardcoded STARTER_INVENTORY constant.
  starterQuantity Int         @default(0)
  inventory   InventoryItem[]
}
```

- [ ] **Step 6: Create the migration**

```bash
npx prisma migrate dev --name pill_admin
```

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 7: Update the seed** — in `backend/prisma/seed.ts`, replace the `PILLS` array so every entry gains `active: true` and its old starter quantity:

```typescript
// Pill catalog mirrors the frontend mock (frontend/src/lib/pill-constants.ts):
// same ids, rarities (0..4), and four effect kinds. Definitions live in the DB
// (not config-in-code) so the catalog can change without a code deploy.
// starterQuantity carries the old hardcoded STARTER_INVENTORY values, so
// registration behavior is unchanged after migration + seed.
// NOTE: re-running the seed upserts full rows, overwriting admin edits — the
// seed is a fresh-setup/reset tool, not a routine command.
const PILLS = [
  { id: 'hoi-khi-dan', name: 'Hồi Khí Đan', glyph: '气', rarity: 0, effectKind: 'linhKhi', amount: 50, desc: 'Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.', active: true, starterQuantity: 5 },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', glyph: '聚', rarity: 2, effectKind: 'linhKhi', amount: 300, desc: 'Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.', active: true, starterQuantity: 3 },
  { id: 'cuu-chuyen-kim-dan', name: 'Cửu Chuyển Kim Đan', glyph: '金', rarity: 4, effectKind: 'linhKhi', amount: 2000, desc: 'Thánh dược cửu chuyển, cộng ngay 2000 linh khí.', active: true, starterQuantity: 1 },
  { id: 'tinh-tam-dan', name: 'Tịnh Tâm Đan', glyph: '静', rarity: 1, effectKind: 'cultivationBuff', multiplier: 1.5, durationSec: 120, desc: 'Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.', active: true, starterQuantity: 2 },
  { id: 'ngung-than-dan', name: 'Ngưng Thần Đan', glyph: '凝', rarity: 3, effectKind: 'cultivationBuff', multiplier: 2, durationSec: 180, desc: 'Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.', active: true, starterQuantity: 1 },
  { id: 'pha-canh-dan', name: 'Phá Cảnh Đan', glyph: '破', rarity: 2, effectKind: 'breakthroughBoost', bonusPct: 15, desc: 'Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 2 },
  { id: 'thien-cang-dan', name: 'Thiên Cang Đan', glyph: '罡', rarity: 4, effectKind: 'breakthroughBoost', bonusPct: 40, desc: 'Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.', active: true, starterQuantity: 1 },
  { id: 'giai-phat-dan', name: 'Giải Phạt Đan', glyph: '解', rarity: 3, effectKind: 'clearPunishment', desc: 'Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.', active: true, starterQuantity: 2 },
];
```

- [ ] **Step 8: Extend `PillRecord`** — in `backend/src/domain/pills/pill.ts`, replace the interface:

```typescript
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
  // Soft-disable flag: inactive pills are invisible/unusable to players but
  // keep their InventoryItem rows (see spec: removal is never a hard delete).
  active: boolean;
  // Units granted to a newly registered user; 0 = not in the starter kit.
  starterQuantity: number;
}
```

- [ ] **Step 9: Fix compile fallout** — three files construct `PillRecord` and now miss the required fields:

In `backend/src/infrastructure/repositories/PrismaPillRepository.ts`, add the two fields to `toPillRecord`'s inline param type:

```typescript
function toPillRecord(row: {
  id: string; name: string; glyph: string; rarity: number; effectKind: string;
  amount: number | null; multiplier: number | null; durationSec: number | null;
  bonusPct: number | null; desc: string; active: boolean; starterQuantity: number;
}): PillRecord {
  return { ...row, effectKind: row.effectKind as PillEffectKind };
}
```

In `backend/tests/fakes/InMemoryPillRepository.ts`, inside `seedStarterDefinitions()`, add the fields to the seeded record:

```typescript
      this.seedPill({ id: pillId, name: pillId, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 0, multiplier: null, durationSec: null, bonusPct: null, desc: '', active: true, starterQuantity: 0 });
```

In `backend/tests/unit/ConsumePillUseCase.test.ts` and `backend/tests/unit/GetInventoryUseCase.test.ts`, extend each file's `pill()` helper defaults with `active: true, starterQuantity: 0` (before the `...over` spread):

```typescript
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: null, multiplier: null, durationSec: null, bonusPct: null, desc: '', active: true, starterQuantity: 0, ...over };
```

(GetInventoryUseCase's helper uses `amount: 10, desc: 'd'` — keep those values, only add the two new fields.)

- [ ] **Step 10: Re-seed and run the full backend suite**

```bash
npm run db:seed && npm test && npx tsc --noEmit
```

Expected: 183 tests pass (182 + the new schema test).

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat(backend): add Pill.active + Pill.starterQuantity columns"
```

---

### Task 2: `validatePillDefinition` (pure domain validator)

**Files:**
- Create: `backend/src/domain/pills/pill.validate.ts`
- Test: `backend/tests/unit/pill.validate.test.ts`

**Interfaces:**
- Consumes: `PillRecord` (with `active`/`starterQuantity`) from Task 1, `DomainError` from `src/domain/errors.ts`.
- Produces: `validatePillDefinition(pill: PillRecord): void` — throws `DomainError('INVALID_PILL_CONFIG', <message>)` on any violation, returns silently when valid. Tasks 4's use cases call this.

- [ ] **Step 1: Write the failing tests** — create `backend/tests/unit/pill.validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validatePillDefinition } from '../../src/domain/pills/pill.validate';
import { PillRecord } from '../../src/domain/pills/pill';
import { DomainError } from '../../src/domain/errors';

function pill(over: Partial<PillRecord> = {}): PillRecord {
  return {
    id: 'test-dan', name: 'Test Đan', glyph: '试', rarity: 0, effectKind: 'linhKhi',
    amount: 50, multiplier: null, durationSec: null, bonusPct: null,
    desc: 'mô tả', active: true, starterQuantity: 0, ...over,
  };
}

function expectInvalid(p: PillRecord) {
  try {
    validatePillDefinition(p);
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe('INVALID_PILL_CONFIG');
  }
}

describe('validatePillDefinition', () => {
  it('accepts a valid pill of each effect kind', () => {
    expect(() => validatePillDefinition(pill())).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'cultivationBuff', amount: null, multiplier: 1.5, durationSec: 60 }))).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'breakthroughBoost', amount: null, bonusPct: 15 }))).not.toThrow();
    expect(() => validatePillDefinition(pill({ effectKind: 'clearPunishment', amount: null }))).not.toThrow();
  });

  it('rejects empty name / glyph / desc', () => {
    expectInvalid(pill({ name: '  ' }));
    expectInvalid(pill({ glyph: '' }));
    expectInvalid(pill({ desc: '' }));
  });

  it('rejects out-of-range or non-integer rarity', () => {
    expectInvalid(pill({ rarity: -1 }));
    expectInvalid(pill({ rarity: 5 }));
    expectInvalid(pill({ rarity: 1.5 }));
  });

  it('rejects negative or non-integer starterQuantity', () => {
    expectInvalid(pill({ starterQuantity: -1 }));
    expectInvalid(pill({ starterQuantity: 0.5 }));
  });

  it('linhKhi requires amount > 0', () => {
    expectInvalid(pill({ amount: null }));
    expectInvalid(pill({ amount: 0 }));
    expectInvalid(pill({ amount: -5 }));
  });

  it('cultivationBuff requires multiplier > 1 and durationSec > 0 (integer)', () => {
    const base = { effectKind: 'cultivationBuff' as const, amount: null };
    expectInvalid(pill({ ...base, multiplier: null, durationSec: 60 }));
    expectInvalid(pill({ ...base, multiplier: 1, durationSec: 60 }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: null }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: 0 }));
    expectInvalid(pill({ ...base, multiplier: 1.5, durationSec: 1.5 }));
  });

  it('breakthroughBoost requires bonusPct > 0', () => {
    const base = { effectKind: 'breakthroughBoost' as const, amount: null };
    expectInvalid(pill({ ...base, bonusPct: null }));
    expectInvalid(pill({ ...base, bonusPct: 0 }));
  });

  it('rejects stat fields orphaned outside their effect kind', () => {
    // linhKhi pill carrying a multiplier
    expectInvalid(pill({ multiplier: 2 }));
    // clearPunishment pill carrying any stat
    expectInvalid(pill({ effectKind: 'clearPunishment', amount: 10 }));
    expectInvalid(pill({ effectKind: 'clearPunishment', amount: null, bonusPct: 5 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/pill.validate.test.ts`
Expected: FAIL — cannot resolve `../../src/domain/pills/pill.validate`.

- [ ] **Step 3: Implement** — create `backend/src/domain/pills/pill.validate.ts`:

```typescript
import { PillRecord, PillEffectKind } from './pill';
import { DomainError } from '../errors';

type StatField = 'amount' | 'multiplier' | 'durationSec' | 'bonusPct';

// Which stat fields each effect kind uses. Fields OUTSIDE a kind's list must be
// null — orphaned values would silently mislead a later admin reading the row
// (e.g. a linhKhi pill carrying a stale bonusPct that looks meaningful).
const KIND_FIELDS: Record<PillEffectKind, StatField[]> = {
  linhKhi: ['amount'],
  cultivationBuff: ['multiplier', 'durationSec'],
  breakthroughBoost: ['bonusPct'],
  clearPunishment: [],
};

function fail(message: string): never {
  throw new DomainError('INVALID_PILL_CONFIG', message);
}

// Business invariants zod's per-field ranges can't express (they depend on
// effectKind). The presentation layer's zod schema handles shape/types; this is
// the single domain authority on what a coherent pill definition is.
export function validatePillDefinition(pill: PillRecord): void {
  if (pill.name.trim() === '') fail('name must not be empty');
  if (pill.glyph.trim() === '') fail('glyph must not be empty');
  if (pill.desc.trim() === '') fail('desc must not be empty');
  if (!Number.isInteger(pill.rarity) || pill.rarity < 0 || pill.rarity > 4) {
    fail('rarity must be an integer between 0 and 4');
  }
  if (!Number.isInteger(pill.starterQuantity) || pill.starterQuantity < 0) {
    fail('starterQuantity must be an integer >= 0');
  }

  const used = KIND_FIELDS[pill.effectKind];

  // Per-kind stat requirements.
  if (pill.effectKind === 'linhKhi' && !(pill.amount !== null && pill.amount > 0)) {
    fail('linhKhi pills require amount > 0');
  }
  if (pill.effectKind === 'cultivationBuff') {
    if (!(pill.multiplier !== null && pill.multiplier > 1)) fail('cultivationBuff pills require multiplier > 1');
    if (!(pill.durationSec !== null && Number.isInteger(pill.durationSec) && pill.durationSec > 0)) {
      fail('cultivationBuff pills require an integer durationSec > 0');
    }
  }
  if (pill.effectKind === 'breakthroughBoost' && !(pill.bonusPct !== null && pill.bonusPct > 0)) {
    fail('breakthroughBoost pills require bonusPct > 0');
  }

  // Orphan check: every stat field not used by this kind must be null.
  const allFields: StatField[] = ['amount', 'multiplier', 'durationSec', 'bonusPct'];
  for (const field of allFields) {
    if (!used.includes(field) && pill[field] !== null) {
      fail(`${field} must be null for effectKind "${pill.effectKind}"`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/pill.validate.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pills/pill.validate.ts tests/unit/pill.validate.test.ts
git commit -m "feat(backend): add pure validatePillDefinition domain validator"
```

---

### Task 3: Repository — admin methods, active filter, DB-driven starter seed

**Files:**
- Modify: `backend/src/domain/ports/PillRepository.ts` (add `listAll`/`create`/`update`; delete `STARTER_INVENTORY`)
- Modify: `backend/src/infrastructure/repositories/PrismaPillRepository.ts`
- Modify: `backend/tests/fakes/InMemoryPillRepository.ts`
- Test: `backend/tests/integration/PrismaPillRepository.test.ts`, `backend/tests/unit/GetInventoryUseCase.test.ts`

**Interfaces:**
- Consumes: `PillRecord` (Task 1).
- Produces (port methods Tasks 4–5 rely on):
  - `listAll(): Promise<PillRecord[]>` — full catalog **including inactive**, ordered by (rarity, id).
  - `create(record: PillRecord): Promise<void>`.
  - `update(record: PillRecord): Promise<boolean>` — full-row update by `id`; `false` when the id doesn't exist.
  - `listInventory` now returns only entries whose pill is `active`.
  - `seedStarterInventory(userId)` now grants every pill with `active && starterQuantity > 0` at its `starterQuantity` (reads the DB, not a constant).
  - `STARTER_INVENTORY` export is **deleted**; the fake keeps a private mirror for its `seedStarterDefinitions()` helper.

- [ ] **Step 1: Write the failing integration tests** — append to `backend/tests/integration/PrismaPillRepository.test.ts` inside the existing `describe`:

```typescript
  it('listAll returns the full catalog including inactive pills', async () => {
    await prisma.pill.create({ data: { id: 'test-inactive', name: 'T', glyph: 't', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 0 } });
    const all = await repo.listAll();
    expect(all.some((p) => p.id === 'test-inactive')).toBe(true);
    expect(all.some((p) => p.id === 'hoi-khi-dan')).toBe(true);
  });

  it('create + update round-trip', async () => {
    await repo.create({ id: 'test-crud', name: 'CRUD Đan', glyph: 'c', rarity: 1, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0 });
    const created = await repo.findById('test-crud');
    expect(created?.name).toBe('CRUD Đan');

    const ok = await repo.update({ ...created!, name: 'CRUD Đan v2', amount: 99 });
    expect(ok).toBe(true);
    const updated = await repo.findById('test-crud');
    expect(updated?.name).toBe('CRUD Đan v2');
    expect(updated?.amount).toBe(99);
  });

  it('update returns false for an unknown id', async () => {
    const ok = await repo.update({ id: 'test-ghost', name: 'G', glyph: 'g', rarity: 0, effectKind: 'linhKhi', amount: 1, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0 });
    expect(ok).toBe(false);
  });

  it('listInventory hides inactive pills but keeps their InventoryItem rows', async () => {
    const userId = await makeUser();
    await prisma.pill.create({ data: { id: 'test-hidden', name: 'H', glyph: 'h', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 0 } });
    await prisma.inventoryItem.create({ data: { userId, pillId: 'test-hidden', quantity: 4 } });

    const inv = await repo.listInventory(userId);
    expect(inv.some((e) => e.pill.id === 'test-hidden')).toBe(false);
    // The row survives — re-enabling restores the holding.
    const row = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId, pillId: 'test-hidden' } } });
    expect(row?.quantity).toBe(4);
  });

  it('seedStarterInventory grants per starterQuantity and skips inactive/zero pills', async () => {
    await prisma.pill.create({ data: { id: 'test-starter', name: 'S', glyph: 's', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: true, starterQuantity: 7 } });
    await prisma.pill.create({ data: { id: 'test-starter-off', name: 'SO', glyph: 's', rarity: 0, effectKind: 'linhKhi', amount: 1, desc: 'd', active: false, starterQuantity: 7 } });
    const userId = await makeUser();
    await repo.seedStarterInventory(userId);

    const rows = await prisma.inventoryItem.findMany({ where: { userId } });
    const byPill = new Map(rows.map((r) => [r.pillId, r.quantity]));
    expect(byPill.get('test-starter')).toBe(7);      // custom starter granted
    expect(byPill.get('hoi-khi-dan')).toBe(5);        // seeded starters still granted
    expect(byPill.has('test-starter-off')).toBe(false); // inactive: not granted
  });
```

Also add cleanup of test-created pills — replace the existing `afterAll` with:

```typescript
  afterAll(async () => {
    // Remove pills created by these tests (and their inventory rows) so other
    // suites see only the seeded catalog.
    await prisma.inventoryItem.deleteMany({ where: { pillId: { startsWith: 'test-' } } });
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Write the failing unit test** — append to `backend/tests/unit/GetInventoryUseCase.test.ts`:

```typescript
  it('omits inactive pills from the inventory listing', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('on'));
    pills.seedPill(pill('off', { active: false }));
    pills.setQuantity('user-1', 'on', 1);
    pills.setQuantity('user-1', 'off', 1);
    const out = await new GetInventoryUseCase(pills).execute('user-1');
    expect(out.map((p) => p.id)).toEqual(['on']);
  });
```

- [ ] **Step 3: Run to verify failures**

Run: `npx vitest run tests/integration/PrismaPillRepository.test.ts tests/unit/GetInventoryUseCase.test.ts`
Expected: FAIL — `listAll`/`create`/`update` don't exist; the inactive-pill tests fail (inactive entries still listed / granted).

- [ ] **Step 4: Update the port** — replace `backend/src/domain/ports/PillRepository.ts` entirely:

```typescript
import { PillRecord, InventoryEntry } from '../pills/pill';

export interface PillRepository {
  findById(pillId: string): Promise<PillRecord | null>;
  // Full catalog INCLUDING inactive pills — admin-only path; player-facing
  // reads go through listInventory, which filters active.
  listAll(): Promise<PillRecord[]>;
  create(record: PillRecord): Promise<void>;
  // Full-row update by id (id itself is immutable). Returns false when the id
  // doesn't exist, so the use case can map it to PILL_NOT_FOUND.
  update(record: PillRecord): Promise<boolean>;
  // Player inventory: only entries whose pill is active (a disabled pill is
  // invisible to players; its InventoryItem row survives for re-enabling).
  listInventory(userId: string): Promise<InventoryEntry[]>;
  // Atomically decrement one unit guarded on quantity > 0. Returns false if the
  // user doesn't own the pill or its quantity is already 0.
  decrementOne(userId: string, pillId: string): Promise<boolean>;
  // Compensating action for decrementOne: gives one unit back when the effect
  // could not be applied (e.g. the character write lost its concurrency guard),
  // so a failed consume never silently burns a pill.
  incrementOne(userId: string, pillId: string): Promise<void>;
  // Grants every active pill with starterQuantity > 0 at that quantity — the
  // starter kit is admin-tunable data on the Pill row, not a code constant.
  seedStarterInventory(userId: string): Promise<void>;
}
```

(Note: `STARTER_INVENTORY` is gone.)

- [ ] **Step 5: Update `PrismaPillRepository`** — in `backend/src/infrastructure/repositories/PrismaPillRepository.ts`: fix the import (drop `STARTER_INVENTORY`), add the three methods, filter `listInventory`, rewrite `seedStarterInventory`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PillRepository } from '../../domain/ports/PillRepository';
import { PillRecord, InventoryEntry, PillEffectKind } from '../../domain/pills/pill';
```

New/changed methods inside the class:

```typescript
  async listAll(): Promise<PillRecord[]> {
    // Deterministic catalog order for the admin UI: rarity tier, then id.
    const rows = await this.client.pill.findMany({ orderBy: [{ rarity: 'asc' }, { id: 'asc' }] });
    return rows.map(toPillRecord);
  }

  async create(record: PillRecord): Promise<void> {
    await this.client.pill.create({ data: record });
  }

  async update(record: PillRecord): Promise<boolean> {
    // updateMany (not update) so an unknown id yields count 0 instead of throwing;
    // id is excluded from data — it is immutable (inventory FK key).
    const { id, ...data } = record;
    const result = await this.client.pill.updateMany({ where: { id }, data });
    return result.count === 1;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const items = await this.client.inventoryItem.findMany({
      // pill.active filter: disabled pills are invisible to players (their
      // InventoryItem rows survive untouched for re-enabling).
      where: { userId, quantity: { gt: 0 }, pill: { active: true } },
      include: { pill: true },
    });
    return items.map((it) => ({ pill: toPillRecord(it.pill), quantity: it.quantity }));
  }

  async seedStarterInventory(userId: string): Promise<void> {
    // The starter kit lives on the Pill rows themselves (admin-tunable), not in
    // a code constant: every active pill with starterQuantity > 0 is granted.
    const starters = await this.client.pill.findMany({
      where: { active: true, starterQuantity: { gt: 0 } },
    });
    await this.client.inventoryItem.createMany({
      data: starters.map((p) => ({ userId, pillId: p.id, quantity: p.starterQuantity })),
      skipDuplicates: true,
    });
  }
```

- [ ] **Step 6: Update the fake** — in `backend/tests/fakes/InMemoryPillRepository.ts`: drop the `STARTER_INVENTORY` import, add a private starter mirror, add the three methods, filter `listInventory`, rewrite `seedStarterInventory`:

```typescript
import { PillRepository } from '../../src/domain/ports/PillRepository';
import { PillRecord, InventoryEntry } from '../../src/domain/pills/pill';

// Mirror of the old STARTER_INVENTORY constant (now DB data): used only by the
// seedStarterDefinitions test helper to register the classic 8-pill starter kit.
const STARTER_DEFS: Array<{ pillId: string; quantity: number }> = [
  { pillId: 'hoi-khi-dan', quantity: 5 },
  { pillId: 'tu-linh-dan', quantity: 3 },
  { pillId: 'cuu-chuyen-kim-dan', quantity: 1 },
  { pillId: 'tinh-tam-dan', quantity: 2 },
  { pillId: 'ngung-than-dan', quantity: 1 },
  { pillId: 'pha-canh-dan', quantity: 2 },
  { pillId: 'thien-cang-dan', quantity: 1 },
  { pillId: 'giai-phat-dan', quantity: 2 },
];
```

Change `seedStarterDefinitions` to carry the quantity on the definition:

```typescript
  seedStarterDefinitions(): void {
    for (const { pillId, quantity } of STARTER_DEFS) {
      this.seedPill({ id: pillId, name: pillId, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 0, multiplier: null, durationSec: null, bonusPct: null, desc: '', active: true, starterQuantity: quantity });
    }
  }
```

New/changed methods:

```typescript
  async listAll(): Promise<PillRecord[]> {
    return [...this.pills.values()];
  }

  async create(record: PillRecord): Promise<void> {
    this.pills.set(record.id, record);
  }

  async update(record: PillRecord): Promise<boolean> {
    if (!this.pills.has(record.id)) return false;
    this.pills.set(record.id, record);
    return true;
  }
```

In `listInventory`, change the push guard to also require `pill.active`:

```typescript
      const pill = this.pills.get(pillId);
      if (pill && pill.active) out.push({ pill, quantity });
```

Rewrite `seedStarterInventory` to read the registered definitions (mirrors the Prisma behavior):

```typescript
  async seedStarterInventory(userId: string): Promise<void> {
    for (const pill of this.pills.values()) {
      if (pill.active && pill.starterQuantity > 0) {
        this.inv.set(`${userId}:${pill.id}`, pill.starterQuantity);
      }
    }
  }
```

- [ ] **Step 7: Run the full backend suite**

```bash
npm test && npx tsc --noEmit
```

Expected: 189 tests pass (183 + 5 integration + 1 unit). `RegisterUserUseCase.test.ts` still passes unchanged — `seedStarterDefinitions` now carries quantities, so `seedStarterInventory` grants the same 8 pills.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(backend): pill repository admin methods, active filter, DB-driven starter kit"
```

---

### Task 4: Use cases — List/Create/Update + Consume inactive guard

**Files:**
- Create: `backend/src/application/ListPillsAdminUseCase.ts`
- Create: `backend/src/application/CreatePillUseCase.ts`
- Create: `backend/src/application/UpdatePillUseCase.ts`
- Modify: `backend/src/application/ConsumePillUseCase.ts` (inactive guard)
- Test: `backend/tests/unit/ListPillsAdminUseCase.test.ts`, `backend/tests/unit/CreatePillUseCase.test.ts`, `backend/tests/unit/UpdatePillUseCase.test.ts`, `backend/tests/unit/ConsumePillUseCase.test.ts`

**Interfaces:**
- Consumes: `PillRepository` (Task 3 shape), `validatePillDefinition` (Task 2), `DomainError`.
- Produces (Task 5's routes call these):
  - `ListPillsAdminUseCase.execute(): Promise<PillRecord[]>`
  - `CreatePillUseCase.execute(record: PillRecord): Promise<PillRecord>` — throws `PILL_ID_TAKEN` on duplicate id, `INVALID_PILL_CONFIG` on invalid definition.
  - `UpdatePillUseCase.execute(record: PillRecord): Promise<PillRecord>` — throws `PILL_NOT_FOUND` on unknown id, `INVALID_PILL_CONFIG` on invalid definition.
  - `ConsumePillUseCase` now throws `PILL_NOT_FOUND` for inactive pills.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/ListPillsAdminUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ListPillsAdminUseCase } from '../../src/application/ListPillsAdminUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('ListPillsAdminUseCase', () => {
  it('returns the full catalog including inactive pills', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    pills.seedPill(pill('b', { active: false }));
    const out = await new ListPillsAdminUseCase(pills).execute();
    expect(out.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });
});
```

Create `backend/tests/unit/CreatePillUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CreatePillUseCase } from '../../src/application/CreatePillUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';
import { DomainError } from '../../src/domain/errors';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('CreatePillUseCase', () => {
  it('creates a valid pill and returns it', async () => {
    const pills = new InMemoryPillRepository();
    const created = await new CreatePillUseCase(pills).execute(pill('new-dan'));
    expect(created.id).toBe('new-dan');
    expect(await pills.findById('new-dan')).not.toBeNull();
  });

  it('rejects a duplicate id with PILL_ID_TAKEN', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('dup'));
    await expect(new CreatePillUseCase(pills).execute(pill('dup')))
      .rejects.toMatchObject({ code: 'PILL_ID_TAKEN' });
  });

  it('rejects an invalid definition with INVALID_PILL_CONFIG and does not persist', async () => {
    const pills = new InMemoryPillRepository();
    await expect(new CreatePillUseCase(pills).execute(pill('bad', { amount: null })))
      .rejects.toBeInstanceOf(DomainError);
    expect(await pills.findById('bad')).toBeNull();
  });
});
```

Create `backend/tests/unit/UpdatePillUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UpdatePillUseCase } from '../../src/application/UpdatePillUseCase';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}

describe('UpdatePillUseCase', () => {
  it('updates an existing pill (including active toggle)', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    const saved = await new UpdatePillUseCase(pills).execute(pill('a', { name: 'Mới', active: false }));
    expect(saved.name).toBe('Mới');
    expect((await pills.findById('a'))?.active).toBe(false);
  });

  it('rejects an unknown id with PILL_NOT_FOUND', async () => {
    const pills = new InMemoryPillRepository();
    await expect(new UpdatePillUseCase(pills).execute(pill('ghost')))
      .rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });

  it('rejects an invalid definition with INVALID_PILL_CONFIG before writing', async () => {
    const pills = new InMemoryPillRepository();
    pills.seedPill(pill('a'));
    await expect(new UpdatePillUseCase(pills).execute(pill('a', { rarity: 9 })))
      .rejects.toMatchObject({ code: 'INVALID_PILL_CONFIG' });
    expect((await pills.findById('a'))?.rarity).toBe(0); // untouched
  });
});
```

Append to `backend/tests/unit/ConsumePillUseCase.test.ts`:

```typescript
  it('rejects an inactive pill with PILL_NOT_FOUND (indistinguishable from missing)', async () => {
    const { pills, useCase } = setup();
    pills.seedPill(pill('off', { effectKind: 'linhKhi', amount: 100, active: false }));
    pills.setQuantity('user-1', 'off', 3);
    await expect(useCase.execute('user-1', 'off'))
      .rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
    // The unit was NOT spent — the guard fires before decrementOne.
    await expect(useCase.execute('user-1', 'off')).rejects.toMatchObject({ code: 'PILL_NOT_FOUND' });
  });
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run tests/unit/ListPillsAdminUseCase.test.ts tests/unit/CreatePillUseCase.test.ts tests/unit/UpdatePillUseCase.test.ts tests/unit/ConsumePillUseCase.test.ts`
Expected: FAIL — the three modules don't exist; the consume test throws nothing (inactive pill consumes fine today).

- [ ] **Step 3: Implement the three use cases**

Create `backend/src/application/ListPillsAdminUseCase.ts`:

```typescript
import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';

export class ListPillsAdminUseCase {
  constructor(private readonly pills: PillRepository) {}

  // Admin catalog view: includes inactive pills (players never see this list).
  async execute(): Promise<PillRecord[]> {
    return this.pills.listAll();
  }
}
```

Create `backend/src/application/CreatePillUseCase.ts`:

```typescript
import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';
import { validatePillDefinition } from '../domain/pills/pill.validate';
import { DomainError } from '../domain/errors';

export class CreatePillUseCase {
  constructor(private readonly pills: PillRepository) {}

  async execute(record: PillRecord): Promise<PillRecord> {
    validatePillDefinition(record);
    // Check-then-create: a concurrent duplicate racing past this check hits the
    // DB primary-key constraint and surfaces as a 500 — acceptable for an
    // admin-only path (see spec), not worth a transaction here.
    const existing = await this.pills.findById(record.id);
    if (existing) {
      throw new DomainError('PILL_ID_TAKEN', `A pill with id "${record.id}" already exists`);
    }
    await this.pills.create(record);
    return record;
  }
}
```

Create `backend/src/application/UpdatePillUseCase.ts`:

```typescript
import { PillRepository } from '../domain/ports/PillRepository';
import { PillRecord } from '../domain/pills/pill';
import { validatePillDefinition } from '../domain/pills/pill.validate';
import { DomainError } from '../domain/errors';

export class UpdatePillUseCase {
  constructor(private readonly pills: PillRepository) {}

  // Full-row update; id comes from the route param and is immutable (it is the
  // inventory FK key). Enable/disable flows through here too — `active` is just
  // a field of the record.
  async execute(record: PillRecord): Promise<PillRecord> {
    validatePillDefinition(record);
    const ok = await this.pills.update(record);
    if (!ok) {
      throw new DomainError('PILL_NOT_FOUND', 'Pill not found');
    }
    return record;
  }
}
```

- [ ] **Step 4: Add the Consume guard** — in `backend/src/application/ConsumePillUseCase.ts`, right after the existing `if (!pill)` block:

```typescript
    // A disabled pill is indistinguishable from a nonexistent one to players —
    // same code, no catalog information leaks. Fires before decrementOne, so
    // the unit is never spent.
    if (!pill.active) {
      throw new DomainError('PILL_NOT_FOUND', 'Pill not found');
    }
```

- [ ] **Step 5: Run the full backend suite**

```bash
npm test && npx tsc --noEmit
```

Expected: 197 tests pass (189 + 1 list + 3 create + 3 update + 1 consume).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(backend): pill admin use cases + consume inactive guard"
```

---

### Task 5: Presentation — schemas, routes, errorHandler, wiring, integration tests

**Files:**
- Modify: `backend/src/presentation/schemas/admin.schemas.ts`
- Modify: `backend/src/presentation/routes/admin.routes.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/errorHandler.test.ts`, `backend/tests/integration/admin.pills.test.ts` (new)

**Interfaces:**
- Consumes: the three use cases (Task 4), `createPillSchema`/`updatePillSchema` (this task), existing `requireAuth`/`requireAdmin`.
- Produces: `GET /admin/pills` → `200 { pills: PillRecord[] }`; `POST /admin/pills` → `201 <PillRecord>`; `PUT /admin/pills/:id` → `200 <PillRecord>`. `AdminRouterDeps` gains `listPillsAdminUseCase`, `createPillUseCase`, `updatePillUseCase`. `STATUS_BY_CODE` gains `INVALID_PILL_CONFIG: 400`, `PILL_ID_TAKEN: 409`.

- [ ] **Step 1: Write the failing errorHandler unit tests** — append to the existing describe in `backend/tests/unit/errorHandler.test.ts` (follow the file's existing test style — read it first):

```typescript
  it('maps INVALID_PILL_CONFIG to 400 and PILL_ID_TAKEN to 409', () => {
    // Follow the existing pattern in this file for invoking errorHandler with a
    // DomainError and asserting res.status — one assertion per code:
    //   errorHandler(new DomainError('INVALID_PILL_CONFIG', 'x'), req, res, next) → 400
    //   errorHandler(new DomainError('PILL_ID_TAKEN', 'x'), req, res, next)       → 409
  });
```

(The comment block above describes intent; write the real test bodies by copying the file's existing known-code test verbatim and swapping the code/status pairs. Two `it` blocks, one per code, is also fine.)

- [ ] **Step 2: Write the failing integration tests** — create `backend/tests/integration/admin.pills.test.ts`:

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

// A fully valid pill body (POST shape: includes id).
function pillBody(id: string, over: Record<string, unknown> = {}) {
  return {
    id, name: 'Test Đan', glyph: '试', rarity: 1, effectKind: 'linhKhi',
    amount: 25, multiplier: null, durationSec: null, bonusPct: null,
    desc: 'mô tả test', active: true, starterQuantity: 0, ...over,
  };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
  // Drop pills created by earlier cases in this file (test-* naming convention).
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
});

afterAll(async () => {
  await prisma.inventoryItem.deleteMany({ where: { pillId: { startsWith: 'test-' } } });
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
  await prisma.$disconnect();
});

describe('/admin/pills', () => {
  it('rejects a non-admin on GET, POST and PUT with 403', async () => {
    const token = await registerAndLogin('bob');
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    expect((await auth(request(app).get('/admin/pills'))).status).toBe(403);
    expect((await auth(request(app).post('/admin/pills').send(pillBody('test-x')))).status).toBe(403);
    expect((await auth(request(app).put('/admin/pills/test-x').send(pillBody('test-x')))).status).toBe(403);
  });

  it('admin CRUD round-trip: create → list (includes inactive) → update → list', async () => {
    const token = await registerAdminAndLogin('root');
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

    const post = await auth(request(app).post('/admin/pills').send(pillBody('test-crud')));
    expect(post.status).toBe(201);
    expect(post.body.id).toBe('test-crud');

    const list1 = await auth(request(app).get('/admin/pills'));
    expect(list1.status).toBe(200);
    expect(list1.body.pills.some((p: { id: string }) => p.id === 'test-crud')).toBe(true);

    const { id: _drop, ...updateBody } = pillBody('test-crud', { name: 'Đổi Tên Đan', amount: 77, active: false });
    const put = await auth(request(app).put('/admin/pills/test-crud').send(updateBody));
    expect(put.status).toBe(200);
    expect(put.body.name).toBe('Đổi Tên Đan');

    // Inactive pills still appear in the admin list.
    const list2 = await auth(request(app).get('/admin/pills'));
    const row = list2.body.pills.find((p: { id: string }) => p.id === 'test-crud');
    expect(row.active).toBe(false);
    expect(row.amount).toBe(77);
  });

  it('rejects a duplicate id with 409 PILL_ID_TAKEN', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('hoi-khi-dan'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PILL_ID_TAKEN');
  });

  it('rejects an invalid definition with 400 INVALID_PILL_CONFIG', async () => {
    const token = await registerAdminAndLogin('root');
    // linhKhi pill without an amount — passes zod nullable but fails the domain rule.
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('test-bad', { amount: null }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PILL_CONFIG');
  });

  it('rejects a bad id slug on create with 400', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).post('/admin/pills')
      .set('Authorization', `Bearer ${token}`).send(pillBody('Test Đan!'));
    expect(res.status).toBe(400);
  });

  it('PUT on an unknown id returns 404 PILL_NOT_FOUND', async () => {
    const token = await registerAdminAndLogin('root');
    const { id: _drop, ...body } = pillBody('test-ghost');
    const res = await request(app).put('/admin/pills/test-ghost')
      .set('Authorization', `Bearer ${token}`).send(body);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PILL_NOT_FOUND');
  });

  it('disabling a pill hides it from the player inventory, blocks consume, and survives re-enable', async () => {
    const adminToken = await registerAdminAndLogin('root');
    const adminAuth = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);

    // Create a pill and hand a player some units directly.
    await adminAuth(request(app).post('/admin/pills').send(pillBody('test-toggle')));
    const playerToken = await registerAndLogin('alice');
    const player = await prisma.user.findUniqueOrThrow({ where: { username: 'alice' } });
    await prisma.inventoryItem.create({ data: { userId: player.id, pillId: 'test-toggle', quantity: 3 } });

    // Visible + consumable while active.
    const invBefore = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invBefore.body.some((p: { id: string }) => p.id === 'test-toggle')).toBe(true);

    // Disable it.
    const { id: _drop, ...body } = pillBody('test-toggle', { active: false });
    await adminAuth(request(app).put('/admin/pills/test-toggle').send(body));

    // Hidden from inventory; consume is a 404; the DB row survives.
    const invAfter = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invAfter.body.some((p: { id: string }) => p.id === 'test-toggle')).toBe(false);
    const consume = await request(app).post('/pills/consume')
      .set('Authorization', `Bearer ${playerToken}`).send({ pillId: 'test-toggle' });
    expect(consume.status).toBe(404);
    const row = await prisma.inventoryItem.findUnique({
      where: { userId_pillId: { userId: player.id, pillId: 'test-toggle' } },
    });
    expect(row?.quantity).toBe(3);

    // Re-enable: holdings are back.
    await adminAuth(request(app).put('/admin/pills/test-toggle').send({ ...body, active: true }));
    const invRestored = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(invRestored.body.find((p: { id: string }) => p.id === 'test-toggle')?.quantity).toBe(3);
  });

  it('registration grants starter inventory per starterQuantity', async () => {
    const adminToken = await registerAdminAndLogin('root');
    await request(app).post('/admin/pills').set('Authorization', `Bearer ${adminToken}`)
      .send(pillBody('test-starter', { starterQuantity: 7 }));

    const playerToken = await registerAndLogin('carol');
    const inv = await request(app).get('/pills/inventory').set('Authorization', `Bearer ${playerToken}`);
    expect(inv.body.find((p: { id: string }) => p.id === 'test-starter')?.quantity).toBe(7);
    // The classic seeded starters are still granted too.
    expect(inv.body.find((p: { id: string }) => p.id === 'hoi-khi-dan')?.quantity).toBe(5);
  });
});
```

- [ ] **Step 3: Run to verify failures**

Run: `npx vitest run tests/unit/errorHandler.test.ts tests/integration/admin.pills.test.ts`
Expected: FAIL — errorHandler maps the new codes to 500; every `/admin/pills` request 404s (route doesn't exist).

- [ ] **Step 4: Add the zod schemas** — append to `backend/src/presentation/schemas/admin.schemas.ts`:

```typescript
// Pill bodies for POST/PUT /admin/pills. Shape/type/range checks live here;
// the per-effectKind coherence rules (which stat fields must be set vs null)
// live in domain validatePillDefinition — zod can't express them cleanly.
const pillBodySchema = z.object({
  name: z.string().min(1),
  glyph: z.string().min(1),
  rarity: z.number().int().min(0).max(4),
  effectKind: z.enum(['linhKhi', 'cultivationBuff', 'breakthroughBoost', 'clearPunishment']),
  amount: z.number().nullable(),
  multiplier: z.number().nullable(),
  durationSec: z.number().int().nullable(),
  bonusPct: z.number().nullable(),
  desc: z.string().min(1),
  active: z.boolean(),
  starterQuantity: z.number().int().min(0),
});

// POST carries the id (kebab-case slug, immutable afterwards); PUT takes it
// from the URL, so the body schema deliberately has no id field.
export const createPillSchema = pillBodySchema.extend({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug (a-z, 0-9, -)'),
});
export const updatePillSchema = pillBodySchema;
```

- [ ] **Step 5: Add the routes** — in `backend/src/presentation/routes/admin.routes.ts`:

Add imports and extend `AdminRouterDeps`:

```typescript
import { updateRealmsSchema, createPillSchema, updatePillSchema } from '../schemas/admin.schemas';
import { ListPillsAdminUseCase } from '../../application/ListPillsAdminUseCase';
import { CreatePillUseCase } from '../../application/CreatePillUseCase';
import { UpdatePillUseCase } from '../../application/UpdatePillUseCase';
```

```typescript
export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
  getAdminStatsUseCase: GetAdminStatsUseCase;
  listPillsAdminUseCase: ListPillsAdminUseCase;
  createPillUseCase: CreatePillUseCase;
  updatePillUseCase: UpdatePillUseCase;
  realmConfigProvider: RealmConfigProvider;
  requireAuth: RequestHandler;
}
```

Add the three routes inside `createAdminRouter` (after the `/stats` route):

```typescript
  router.get('/pills', async (_req, res, next) => {
    try {
      res.status(200).json({ pills: await deps.listPillsAdminUseCase.execute() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/pills', async (req, res, next) => {
    try {
      const parsed = createPillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_PILL_CONFIG', parsed.error.issues[0].message);
      }
      const saved = await deps.createPillUseCase.execute(parsed.data);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });

  router.put('/pills/:id', async (req, res, next) => {
    try {
      const parsed = updatePillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_PILL_CONFIG', parsed.error.issues[0].message);
      }
      // id comes from the URL only — it is immutable (inventory FK key), so the
      // body schema has no id field a client could try to change.
      const saved = await deps.updatePillUseCase.execute({ ...parsed.data, id: req.params.id });
      res.status(200).json(saved);
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 6: Map the new error codes** — in `backend/src/presentation/middleware/errorHandler.ts`, add to `STATUS_BY_CODE`:

```typescript
  INVALID_PILL_CONFIG: 400,
  PILL_ID_TAKEN: 409,
```

- [ ] **Step 7: Wire the composition root** — in `backend/src/app.ts`:

```typescript
import { ListPillsAdminUseCase } from './application/ListPillsAdminUseCase';
import { CreatePillUseCase } from './application/CreatePillUseCase';
import { UpdatePillUseCase } from './application/UpdatePillUseCase';
```

```typescript
  const listPillsAdminUseCase = new ListPillsAdminUseCase(pillRepository);
  const createPillUseCase = new CreatePillUseCase(pillRepository);
  const updatePillUseCase = new UpdatePillUseCase(pillRepository);
```

And extend the `createAdminRouter` call:

```typescript
  app.use(
    '/admin',
    createAdminRouter({ updateRealmConfigUseCase, getAdminStatsUseCase, listPillsAdminUseCase, createPillUseCase, updatePillUseCase, realmConfigProvider, requireAuth }),
  );
```

- [ ] **Step 8: Run the full backend suite**

```bash
npm test && npx tsc --noEmit
```

Expected: 206 tests pass (197 + 1 errorHandler + 8 integration). If the errorHandler addition was written as 2 tests, 207 — record the actual number.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(backend): GET/POST/PUT /admin/pills endpoints"
```

---

### Task 6: Frontend data layer — types + api + stub tests

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Consumes: backend endpoints from Task 5.
- Produces (Task 8's page imports these):
  - `AdminPillDTO` — `{ id, name, glyph, rarity: PillRarity, effectKind: PillEffectKind, amount, multiplier, durationSec, bonusPct, desc, active: boolean, starterQuantity: number }`.
  - `fetchAdminPills(): Promise<{ pills: AdminPillDTO[] }>`
  - `createAdminPill(pill: AdminPillDTO): Promise<AdminPillDTO>`
  - `updateAdminPill(id: string, body: Omit<AdminPillDTO, "id">): Promise<AdminPillDTO>`

- [ ] **Step 1: Write the failing tests** — append to `frontend/src/lib/api.test.ts` (uses the file's existing `jsonResponse` helper and `vi.stubGlobal` pattern):

```typescript
describe("admin pill endpoints", () => {
  const samplePill = {
    id: "test-dan", name: "Test Đan", glyph: "试", rarity: 1, effectKind: "linhKhi",
    amount: 25, multiplier: null, durationSec: null, bonusPct: null,
    desc: "d", active: true, starterQuantity: 0,
  };

  it("fetchAdminPills GETs /admin/pills", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { pills: [samplePill] }));
    vi.stubGlobal("fetch", fetchMock);
    const data = await fetchAdminPills();
    expect(data.pills[0].id).toBe("test-dan");
    expect(fetchMock.mock.calls[0][0]).toContain("/admin/pills");
  });

  it("createAdminPill POSTs the full pill including id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, samplePill));
    vi.stubGlobal("fetch", fetchMock);
    await createAdminPill(samplePill);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/admin/pills");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string).id).toBe("test-dan");
  });

  it("updateAdminPill PUTs to /admin/pills/:id without id in the body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, samplePill));
    vi.stubGlobal("fetch", fetchMock);
    const { id, ...body } = samplePill;
    await updateAdminPill(id, body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/admin/pills/test-dan");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string).id).toBeUndefined();
  });
});
```

Add `fetchAdminPills, createAdminPill, updateAdminPill` to the import from `./api` at the top of the test file. Type the sample as `AdminPillDTO` (import from `./types`) so tsc verifies the DTO shape.

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test`
Expected: FAIL — `fetchAdminPills` is not exported.

- [ ] **Step 3: Add the type** — append to `frontend/src/lib/types.ts`:

```typescript
// Full pill definition as the admin catalog editor sees it (GET/POST/PUT
// /admin/pills). Unlike PillInventoryItem, this carries the admin-only
// fields: active (soft-disable) and starterQuantity (new-player grant).
export interface AdminPillDTO {
  id: string;
  name: string;
  glyph: string;
  rarity: PillRarity;
  effectKind: PillEffectKind;
  amount: number | null;
  multiplier: number | null;
  durationSec: number | null;
  bonusPct: number | null;
  desc: string;
  active: boolean;
  starterQuantity: number;
}
```

- [ ] **Step 4: Add the api functions** — in `frontend/src/lib/api.ts`, add `AdminPillDTO` to the type import and append:

```typescript
// GET /admin/pills — the full catalog, inactive pills included.
export function fetchAdminPills(): Promise<{ pills: AdminPillDTO[] }> {
  return apiFetch<{ pills: AdminPillDTO[] }>("/admin/pills");
}

// POST /admin/pills — create a pill (id chosen once here, immutable after).
export function createAdminPill(pill: AdminPillDTO): Promise<AdminPillDTO> {
  return apiFetch<AdminPillDTO>("/admin/pills", {
    method: "POST",
    body: JSON.stringify(pill),
  });
}

// PUT /admin/pills/:id — full-row update; the id travels in the URL only.
export function updateAdminPill(
  id: string,
  body: Omit<AdminPillDTO, "id">,
): Promise<AdminPillDTO> {
  return apiFetch<AdminPillDTO>(`/admin/pills/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 5: Run the frontend gate**

Run: `pnpm lint && npx tsc --noEmit && pnpm test`
Expected: lint/tsc clean, 44 tests pass (41 + 3).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): admin pill api functions + AdminPillDTO"
```

---

### Task 7: Frontend `pill-validation` (pure mirror of the backend rules)

**Files:**
- Create: `frontend/src/lib/pill-validation.ts`
- Test: `frontend/src/lib/pill-validation.test.ts`

**Interfaces:**
- Consumes: `AdminPillDTO` (Task 6).
- Produces (Task 8's page imports these):
  - `interface PillDraftError { field: string; message: string }`
  - `validatePillDraft(pill: AdminPillDTO, opts: { isNew: boolean }): PillDraftError[]`
  - `findPillError(errors: PillDraftError[], field: string): PillDraftError | undefined`

- [ ] **Step 1: Write the failing tests** — create `frontend/src/lib/pill-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { findPillError, validatePillDraft } from "./pill-validation";
import type { AdminPillDTO } from "./types";

function pill(over: Partial<AdminPillDTO> = {}): AdminPillDTO {
  return {
    id: "test-dan", name: "Test Đan", glyph: "试", rarity: 0, effectKind: "linhKhi",
    amount: 50, multiplier: null, durationSec: null, bonusPct: null,
    desc: "mô tả", active: true, starterQuantity: 0, ...over,
  };
}

describe("validatePillDraft", () => {
  it("accepts a valid pill of each effect kind", () => {
    expect(validatePillDraft(pill(), { isNew: false })).toEqual([]);
    expect(validatePillDraft(pill({ effectKind: "cultivationBuff", amount: null, multiplier: 1.5, durationSec: 60 }), { isNew: false })).toEqual([]);
    expect(validatePillDraft(pill({ effectKind: "breakthroughBoost", amount: null, bonusPct: 15 }), { isNew: false })).toEqual([]);
    expect(validatePillDraft(pill({ effectKind: "clearPunishment", amount: null }), { isNew: false })).toEqual([]);
  });

  it("checks the id slug only when creating", () => {
    const bad = pill({ id: "Xấu Id!" });
    expect(findPillError(validatePillDraft(bad, { isNew: true }), "id")).toBeDefined();
    // When editing, the id is server-fixed and read-only — never re-validated.
    expect(findPillError(validatePillDraft(bad, { isNew: false }), "id")).toBeUndefined();
  });

  it("flags empty name/glyph/desc and bad rarity/starterQuantity", () => {
    const errors = validatePillDraft(
      pill({ name: " ", glyph: "", desc: "", rarity: 7 as AdminPillDTO["rarity"], starterQuantity: -1 }),
      { isNew: false },
    );
    for (const field of ["name", "glyph", "desc", "rarity", "starterQuantity"]) {
      expect(findPillError(errors, field)).toBeDefined();
    }
  });

  it("requires each kind's stat fields (NaN from an empty input blocks save)", () => {
    expect(findPillError(validatePillDraft(pill({ amount: null }), { isNew: false }), "amount")).toBeDefined();
    expect(findPillError(validatePillDraft(pill({ amount: Number.NaN }), { isNew: false }), "amount")).toBeDefined();
    const buff = pill({ effectKind: "cultivationBuff", amount: null, multiplier: 1, durationSec: 0 });
    const errors = validatePillDraft(buff, { isNew: false });
    expect(findPillError(errors, "multiplier")).toBeDefined(); // must be > 1
    expect(findPillError(errors, "durationSec")).toBeDefined(); // must be > 0
    expect(findPillError(validatePillDraft(pill({ effectKind: "breakthroughBoost", amount: null, bonusPct: 0 }), { isNew: false }), "bonusPct")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./pill-validation`.

- [ ] **Step 3: Implement** — create `frontend/src/lib/pill-validation.ts`:

```typescript
import type { AdminPillDTO, PillEffectKind } from "./types";

// Client-side mirror of the backend's pill validation (zod shape checks +
// domain validatePillDefinition), so the editor pins errors to fields before a
// request is ever sent. The backend remains the authority — this only has to
// agree with it. Same pattern as realm-validation.ts.
export interface PillDraftError {
  field: string;
  message: string;
}

const KIND_FIELDS: Record<
  PillEffectKind,
  Array<"amount" | "multiplier" | "durationSec" | "bonusPct">
> = {
  linhKhi: ["amount"],
  cultivationBuff: ["multiplier", "durationSec"],
  breakthroughBoost: ["bonusPct"],
  clearPunishment: [],
};

export function validatePillDraft(
  pill: AdminPillDTO,
  opts: { isNew: boolean },
): PillDraftError[] {
  const errors: PillDraftError[] = [];
  const fail = (field: string, message: string) =>
    errors.push({ field, message });

  // The id is chosen once at creation (kebab-case slug) and immutable after —
  // when editing, it is read-only and never re-validated.
  if (opts.isNew && !/^[a-z0-9-]+$/.test(pill.id)) {
    fail("id", "Chỉ gồm a-z, 0-9 và dấu gạch ngang");
  }
  if (pill.name.trim() === "") fail("name", "Tên không được để trống");
  if (pill.glyph.trim() === "") fail("glyph", "Không được để trống");
  if (pill.desc.trim() === "") fail("desc", "Mô tả không được để trống");
  if (!Number.isInteger(pill.rarity) || pill.rarity < 0 || pill.rarity > 4) {
    fail("rarity", "Độ hiếm trong khoảng 0–4");
  }
  if (!Number.isInteger(pill.starterQuantity) || pill.starterQuantity < 0) {
    fail("starterQuantity", "Số nguyên ≥ 0");
  }

  // Per-kind stat requirements — NaN (empty numeric input) fails all of these.
  if (pill.effectKind === "linhKhi" && !(pill.amount !== null && pill.amount > 0)) {
    fail("amount", "Phải là số > 0");
  }
  if (pill.effectKind === "cultivationBuff") {
    if (!(pill.multiplier !== null && pill.multiplier > 1)) {
      fail("multiplier", "Phải là số > 1");
    }
    if (
      !(
        pill.durationSec !== null &&
        Number.isInteger(pill.durationSec) &&
        pill.durationSec > 0
      )
    ) {
      fail("durationSec", "Số nguyên > 0");
    }
  }
  if (
    pill.effectKind === "breakthroughBoost" &&
    !(pill.bonusPct !== null && pill.bonusPct > 0)
  ) {
    fail("bonusPct", "Phải là số > 0");
  }

  return errors;
}

export function findPillError(
  errors: PillDraftError[],
  field: string,
): PillDraftError | undefined {
  return errors.find((e) => e.field === field);
}
```

Note: `NaN > 0` is `false` and `Number.isInteger(NaN)` is `false`, so an empty numeric input (which the form stores as `NaN`) fails the relevant rule — matching the realms editor's "empty input blocks Save" behavior. The orphan-fields rule needs no client check: the form nulls non-kind fields automatically on kind switch (Task 8's `statsForKind`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 48 tests (44 + 4).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(frontend): pill draft validation mirroring backend rules"
```

---

### Task 8: Frontend `/admin/pills` page + nav link + CSS

**Files:**
- Create: `frontend/src/app/admin/pills/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx` (nav link)
- Modify: `frontend/src/app/globals.css` (pill-editor styles)

**Interfaces:**
- Consumes: `fetchAdminPills`/`createAdminPill`/`updateAdminPill` (Task 6), `validatePillDraft`/`findPillError` (Task 7), `getRarityMeta`/`RARITY_META` (existing `pill-constants.ts`), existing `admin-*` CSS classes.
- Produces: the user-facing editor. No downstream consumers.

- [ ] **Step 1: Add the nav link** — in `frontend/src/app/admin/layout.tsx`, insert between the "Cảnh giới" link and the "← Về game" link:

```tsx
          <Link
            href="/admin/pills"
            aria-current={pathname === "/admin/pills" ? "page" : undefined}
          >
            Đan dược
          </Link>
```

- [ ] **Step 2: Create the page** — create `frontend/src/app/admin/pills/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminPill, fetchAdminPills, updateAdminPill } from "@/lib/api";
import { getRarityMeta } from "@/lib/pill-constants";
import { findPillError, validatePillDraft } from "@/lib/pill-validation";
import type { AdminPillDTO, PillEffectKind, PillRarity } from "@/lib/types";

const EFFECT_KINDS: { value: PillEffectKind; label: string }[] = [
  { value: "linhKhi", label: "Tăng linh khí" },
  { value: "cultivationBuff", label: "Buff tốc độ tu" },
  { value: "breakthroughBoost", label: "Tăng tỉ lệ đột phá" },
  { value: "clearPunishment", label: "Giải trừng phạt" },
];

const RARITIES: PillRarity[] = [0, 1, 2, 3, 4];

// Which stat fields each effect kind uses, mirroring the backend's rule that
// non-kind fields must be null. Switching kinds resets stats accordingly.
function statsForKind(
  kind: PillEffectKind,
): Pick<AdminPillDTO, "amount" | "multiplier" | "durationSec" | "bonusPct"> {
  switch (kind) {
    case "linhKhi":
      return { amount: 50, multiplier: null, durationSec: null, bonusPct: null };
    case "cultivationBuff":
      return { amount: null, multiplier: 1.5, durationSec: 60, bonusPct: null };
    case "breakthroughBoost":
      return { amount: null, multiplier: null, durationSec: null, bonusPct: 10 };
    case "clearPunishment":
      return { amount: null, multiplier: null, durationSec: null, bonusPct: null };
  }
}

function emptyPill(): AdminPillDTO {
  return {
    id: "",
    name: "",
    glyph: "",
    rarity: 0,
    effectKind: "linhKhi",
    ...statsForKind("linhKhi"),
    desc: "",
    active: true,
    starterQuantity: 0,
  };
}

// One-line effect summary for the collapsed card.
function headlineStat(pill: AdminPillDTO): string {
  switch (pill.effectKind) {
    case "linhKhi":
      return `+${pill.amount ?? "?"} linh khí`;
    case "cultivationBuff":
      return `×${pill.multiplier ?? "?"} trong ${pill.durationSec ?? "?"}s`;
    case "breakthroughBoost":
      return `+${pill.bonusPct ?? "?"}% đột phá`;
    case "clearPunishment":
      return "Giải trừng phạt";
  }
}

// The numeric stat inputs shown for each effect kind.
const STAT_FIELDS: {
  key: "amount" | "multiplier" | "durationSec" | "bonusPct";
  label: string;
}[] = [
  { key: "amount", label: "Linh khí cộng" },
  { key: "multiplier", label: "Hệ số tốc độ" },
  { key: "durationSec", label: "Thời gian (giây)" },
  { key: "bonusPct", label: "Cộng tỉ lệ (%)" },
];

interface PillFormProps {
  initial: AdminPillDTO;
  isNew: boolean;
  onSaved: (saved: AdminPillDTO) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function PillForm({ initial, isNew, onSaved, onCancel, onDirtyChange }: PillFormProps) {
  const [draft, setDraft] = useState<AdminPillDTO>(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const errors = useMemo(() => validatePillDraft(draft, { isNew }), [draft, isNew]);
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial],
  );

  useEffect(() => {
    onDirtyChange(dirty);
    // Leaving the form (unmount) means the draft is gone — no longer dirty.
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const set = <K extends keyof AdminPillDTO>(key: K, value: AdminPillDTO[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setKind = (kind: PillEffectKind) =>
    // Reset stat fields on kind switch: non-kind fields must be null (backend
    // rejects orphans), the new kind's fields get editable defaults.
    setDraft((d) => ({ ...d, effectKind: kind, ...statsForKind(kind) }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = isNew
        ? await createAdminPill(draft)
        : await updateAdminPill(draft.id, (({ id: _id, ...body }) => body)(draft));
      onSaved(saved);
    } catch (e) {
      // Keep the draft; surface the server's message (e.g. PILL_ID_TAKEN).
      setSaveError(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const usedStats = STAT_FIELDS.filter(
    (f) => statsForKind(draft.effectKind)[f.key] !== null || draft[f.key] !== null,
  );
  const idError = findPillError(errors, "id");

  return (
    <div className="admin-pill-form">
      <div className="admin-pill-form-grid">
        <label>
          ID
          <input
            className={`admin-input${idError ? " invalid" : ""}`}
            value={draft.id}
            onChange={(e) => set("id", e.target.value)}
            readOnly={!isNew}
            aria-label="ID đan dược"
          />
          {idError && <span className="admin-field-error">{idError.message}</span>}
        </label>
        <label>
          Tên
          <input
            className={`admin-input${findPillError(errors, "name") ? " invalid" : ""}`}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            aria-label="Tên đan dược"
          />
        </label>
        <label>
          Glyph
          <input
            className={`admin-input${findPillError(errors, "glyph") ? " invalid" : ""}`}
            value={draft.glyph}
            onChange={(e) => set("glyph", e.target.value)}
            aria-label="Glyph đan dược"
          />
        </label>
        <label>
          Độ hiếm
          <select
            className="admin-input"
            value={draft.rarity}
            onChange={(e) => set("rarity", Number(e.target.value) as PillRarity)}
            aria-label="Độ hiếm"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {getRarityMeta(r).name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hiệu ứng
          <select
            className="admin-input"
            value={draft.effectKind}
            onChange={(e) => setKind(e.target.value as PillEffectKind)}
            aria-label="Loại hiệu ứng"
          >
            {EFFECT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {usedStats.map((f) => {
          const err = findPillError(errors, f.key);
          return (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                className={`admin-input${err ? " invalid" : ""}`}
                value={Number.isNaN(draft[f.key] as number) ? "" : (draft[f.key] ?? "")}
                onChange={(e) =>
                  set(f.key, e.target.value === "" ? Number.NaN : Number(e.target.value))
                }
                aria-label={f.label}
              />
              {err && <span className="admin-field-error">{err.message}</span>}
            </label>
          );
        })}
        <label>
          Phát tân thủ
          <input
            type="number"
            className={`admin-input${findPillError(errors, "starterQuantity") ? " invalid" : ""}`}
            value={Number.isNaN(draft.starterQuantity) ? "" : draft.starterQuantity}
            onChange={(e) =>
              set("starterQuantity", e.target.value === "" ? Number.NaN : Number(e.target.value))
            }
            aria-label="Số lượng phát cho người chơi mới"
          />
        </label>
        <label className="admin-pill-desc">
          Mô tả
          <textarea
            className={`admin-input${findPillError(errors, "desc") ? " invalid" : ""}`}
            value={draft.desc}
            onChange={(e) => set("desc", e.target.value)}
            rows={2}
            aria-label="Mô tả đan dược"
          />
        </label>
        <label className="admin-pill-active">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            aria-label="Đang kích hoạt"
          />
          Kích hoạt (tắt để ẩn khỏi người chơi — túi đồ được giữ nguyên)
        </label>
      </div>

      {saveError && <p className="admin-error">{saveError}</p>}

      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={save}
          disabled={saving || errors.length > 0 || (!dirty && !isNew)}
        >
          {saving ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={saving}>
          {dirty ? "Hoàn tác" : "Đóng"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPillsPage() {
  const [pills, setPills] = useState<AdminPillDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "new" = the create form; a pill id = that pill's edit form; null = all closed.
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { pills: list } = await fetchAdminPills();
      setPills(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được danh sách");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Warn on tab close/refresh while an open form has unsaved edits. In-app
  // navigation is not intercepted (App Router has no route-guard API) —
  // consistent with the realms editor.
  useEffect(() => {
    if (!dirtyOpen) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyOpen]);

  const onSaved = (saved: AdminPillDTO) => {
    setPills((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved];
      return prev.map((p) => (p.id === saved.id ? saved : p));
    });
    setOpenId(null);
  };

  if (loadError) {
    return (
      <div>
        <p className="admin-error">{loadError}</p>
        <button type="button" className="admin-btn" onClick={load}>
          Thử lại
        </button>
      </div>
    );
  }
  if (pills === null) {
    return <p>Đang tải…</p>;
  }

  return (
    <div>
      <div className="admin-toolbar">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => setOpenId("new")}
          disabled={openId === "new"}
        >
          Thêm đan dược
        </button>
      </div>

      {openId === "new" && (
        <div className="admin-pill-card">
          <PillForm
            initial={emptyPill()}
            isNew
            onSaved={onSaved}
            onCancel={() => setOpenId(null)}
            onDirtyChange={setDirtyOpen}
          />
        </div>
      )}

      <div className="admin-pill-list">
        {pills.map((pill) => {
          const meta = getRarityMeta(pill.rarity);
          const open = openId === pill.id;
          return (
            <div key={pill.id} className={`admin-pill-card${pill.active ? "" : " inactive"}`}>
              <button
                type="button"
                className="admin-pill-head"
                onClick={() => setOpenId(open ? null : pill.id)}
                aria-expanded={open}
              >
                <span className="admin-pill-glyph" style={{ color: meta.color }}>
                  {pill.glyph}
                </span>
                <span className="admin-pill-name">{pill.name}</span>
                <span className="admin-pill-rarity" style={{ color: meta.color }}>
                  {meta.name}
                </span>
                <span className="admin-pill-stat">{headlineStat(pill)}</span>
                {pill.starterQuantity > 0 && (
                  <span className="admin-pill-starter">Tân thủ ×{pill.starterQuantity}</span>
                )}
                {!pill.active && <span className="admin-pill-off">Đang tắt</span>}
              </button>
              {open && (
                <PillForm
                  initial={pill}
                  isNew={false}
                  onSaved={onSaved}
                  onCancel={() => setOpenId(null)}
                  onDirtyChange={setDirtyOpen}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the CSS** — append to `frontend/src/app/globals.css` (after the existing `.admin-*` block; reuse tokens already defined there):

```css
/* ---- Admin pill catalog editor ---- */
.admin-pill-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.admin-pill-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.admin-pill-card.inactive {
  opacity: 0.6;
}

.admin-pill-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
  min-height: 44px;
}

.admin-pill-glyph {
  font-size: 1.4rem;
  line-height: 1;
}

.admin-pill-name {
  font-weight: 600;
}

.admin-pill-rarity,
.admin-pill-stat,
.admin-pill-starter {
  font-size: 0.85rem;
  color: var(--muted);
}

.admin-pill-off {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--danger, #f87171);
  color: var(--danger, #f87171);
}

.admin-pill-form {
  padding: 0.75rem 1rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-pill-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
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

.admin-pill-active {
  grid-column: 1 / -1;
  flex-direction: row !important;
  align-items: center;
}
```

Check `globals.css` for an existing `--danger` token first; if none exists, keep the `#f87171` fallback as written.

- [ ] **Step 4: Run the full frontend gate**

Run: `pnpm lint && npx tsc --noEmit && pnpm test && pnpm build`
Expected: all green, 48 tests, build succeeds. Fix any Biome a11y complaints by following the codebase's existing patterns (e.g. real `<button>` elements, aria labels — already used above).

- [ ] **Step 5: Visual smoke check** (needs backend up: `cd ../backend && docker compose up -d --build`)

```bash
pnpm dev
```

Log in as an admin (promote via SQL if needed: `docker compose exec db psql -U postgres -d cultivation -c "UPDATE \"User\" SET role='admin' WHERE username='<name>';"` then re-login). Visit `/admin/pills`: the 8 seeded pills render as cards; expanding one shows the form; kind-switch swaps stat fields; invalid input pins an error and disables Lưu. This is a human-observation gate — note anything off rather than asserting perfection.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): /admin/pills catalog editor"
```

---

### Task 9: Final verification, CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (repo root)

- [ ] **Step 1: Full backend suite, twice** (guards against order-dependent flakes; the suite is serialized on one DB)

```bash
cd backend && npm test && npm test && npx tsc --noEmit
```

Expected: identical pass counts both runs (~206).

- [ ] **Step 2: Full frontend gate**

```bash
cd ../frontend && pnpm lint && npx tsc --noEmit && pnpm test && pnpm build
```

Expected: green, 48 tests.

- [ ] **Step 3: Manual cookie-jar pass against Docker** (backend on `:5000`)

```bash
cd ../backend && docker compose up -d --build && npx prisma migrate deploy && npm run db:seed
```

Then walk the contract (adjust usernames to avoid collisions):

```bash
B=http://localhost:5000
# 1. register admin-to-be + promote + login
curl -s -c /tmp/adm.jar -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"pilladmin","password":"password123"}'
docker compose exec db psql -U postgres -d cultivation -c "UPDATE \"User\" SET role='admin' WHERE username='pilladmin';"
curl -s -c /tmp/adm.jar -X POST $B/auth/login -H 'Content-Type: application/json' -d '{"username":"pilladmin","password":"password123"}'
# 2. GET catalog (expect 8 pills, starterQuantity populated)
curl -s -b /tmp/adm.jar $B/admin/pills | head -c 600
# 3. create a pill
curl -s -b /tmp/adm.jar -X POST $B/admin/pills -H 'Content-Type: application/json' -d '{"id":"manual-dan","name":"Manual Đan","glyph":"手","rarity":2,"effectKind":"linhKhi","amount":123,"multiplier":null,"durationSec":null,"bonusPct":null,"desc":"tạo tay","active":true,"starterQuantity":4}'
# 4. register a fresh player → inventory contains manual-dan ×4
curl -s -c /tmp/ply.jar -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"username":"pillplayer","password":"password123"}'
curl -s -b /tmp/ply.jar $B/pills/inventory | grep -o 'manual-dan' && echo GRANTED
# 5. disable it → vanishes from player inventory, consume 404
curl -s -b /tmp/adm.jar -X PUT $B/admin/pills/manual-dan -H 'Content-Type: application/json' -d '{"name":"Manual Đan","glyph":"手","rarity":2,"effectKind":"linhKhi","amount":123,"multiplier":null,"durationSec":null,"bonusPct":null,"desc":"tạo tay","active":false,"starterQuantity":4}'
curl -s -b /tmp/ply.jar $B/pills/inventory | grep -c 'manual-dan' || echo HIDDEN
curl -s -b /tmp/ply.jar -o /dev/null -w '%{http_code}\n' -X POST $B/pills/consume -H 'Content-Type: application/json' -d '{"pillId":"manual-dan"}'   # expect 404
# 6. non-admin blocked
curl -s -b /tmp/ply.jar -o /dev/null -w '%{http_code}\n' $B/admin/pills   # expect 403
# 7. duplicate id
curl -s -b /tmp/adm.jar -o /dev/null -w '%{http_code}\n' -X POST $B/admin/pills -H 'Content-Type: application/json' -d '{"id":"hoi-khi-dan","name":"X","glyph":"x","rarity":0,"effectKind":"linhKhi","amount":1,"multiplier":null,"durationSec":null,"bonusPct":null,"desc":"x","active":true,"starterQuantity":0}'   # expect 409
```

Cleanup afterwards:

```bash
docker compose exec db psql -U postgres -d cultivation -c "DELETE FROM \"InventoryItem\" WHERE \"pillId\"='manual-dan'; DELETE FROM \"Pill\" WHERE id='manual-dan'; DELETE FROM \"Character\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE username IN ('pilladmin','pillplayer')); DELETE FROM \"InventoryItem\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE username IN ('pilladmin','pillplayer')); DELETE FROM \"User\" WHERE username IN ('pilladmin','pillplayer');"
```

- [ ] **Step 4: Update CLAUDE.md** — add a new `## Admin Pill Catalog` section at the end summarizing: the two new `Pill` columns, `STARTER_INVENTORY` deletion (DB-driven starter kit), the three endpoints, the two new error codes, the inactive-consume guard, frontend `/admin/pills` page + `pill-validation.ts`, final test counts, and the manual-verification result. Follow the existing sections' density and tone.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: record admin pill catalog feature in CLAUDE.md"
```

---

## Self-Review Notes (already applied)

- **Spec coverage:** schema/migration (T1), validator (T2), repository incl. active filter + DB starter kit + `STARTER_INVENTORY` deletion (T3), use cases + consume guard (T4), routes/errorHandler/wiring + integration (T5), frontend data (T6), client validation (T7), page/nav/CSS (T8), verification + CLAUDE.md (T9). Every spec section maps to a task.
- **Type consistency:** `PillRecord` fields (`active`, `starterQuantity`) match `AdminPillDTO`; `update(record) → boolean` consumed as `PILL_NOT_FOUND` in T4; route dep names in T5's `AdminRouterDeps` match `app.ts` wiring.
- **Known intentional gaps:** errorHandler test step describes copying the file's existing pattern rather than inlining unseen code — the executor must read that file first (its style is short and self-evident). `--danger` CSS token existence must be checked in Step 3 of Task 8.
