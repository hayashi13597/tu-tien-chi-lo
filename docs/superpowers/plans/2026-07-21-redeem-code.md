# Redeem Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create shareable redeem codes that grant a bundle of pills; players redeem each code once via a header-menu modal, capped by a total redemption count and an optional expiry.

**Architecture:** Clean Architecture backend (domain → application → infrastructure/presentation). Redemption atomicity uses DB-enforced uniqueness (`Redemption @@unique([codeId, userId])` for per-user-once) plus an atomic `updateMany` cap guard (`redeemedCount < maxRedemptions`) with saga-style compensation — no cross-repo transactions in the application layer. Frontend mirrors the existing pill-admin patterns.

**Tech Stack:** Node/Express + TypeScript, Prisma + Postgres, Vitest + supertest (backend); Next.js 16 App Router, React 19, GSAP, Vitest (frontend).

## Global Constraints

- **Clean Architecture:** `domain/` has zero framework deps and defines ports; `application/` depends only on domain interfaces; `infrastructure/`/`presentation/` implement them. `domain` must never import `infrastructure`/`presentation`.
- **context7 before library APIs:** fetch current docs (via `ctx7` CLI) for Prisma/Express/zod/Next.js before using their APIs; cross-check against pinned `package.json` versions.
- **No cross-repo transactions in application layer** — use DB-enforced guards + saga compensation (established pattern: `ConsumePillUseCase`).
- **Error shape:** every API error is `{ error: { code, message } }`, mapped only in `presentation/middleware/errorHandler.ts`.
- **Code normalization:** redeem codes are normalized (trim + uppercase) at both create and lookup — the single source of truth for case-insensitive matching.
- **Scope:** pill rewards only. No rate limiting on `POST /redeem` (deferred).
- **Comment the *why*** for non-trivial logic (formulas, concurrency guards).
- **Update `CLAUDE.md`** after completing the feature.
- Commit messages omit any Co-Authored-By trailer.

---

## File Structure

**Backend — create:**
- `backend/src/domain/redeem/redeemCode.ts` — pure types (`RewardEntry`, `RedeemCodeRecord`, `RedeemResultDto`).
- `backend/src/domain/redeem/redeemCode.validate.ts` — `validateRedeemCodeDefinition` + `normalizeCode`.
- `backend/src/domain/ports/RedeemCodeRepository.ts` — the port.
- `backend/src/application/RedeemCodeUseCase.ts` — player redemption.
- `backend/src/application/ListRedeemCodesUseCase.ts` — admin list.
- `backend/src/application/CreateRedeemCodeUseCase.ts` — admin create.
- `backend/src/application/UpdateRedeemCodeUseCase.ts` — admin update.
- `backend/src/infrastructure/repositories/PrismaRedeemCodeRepository.ts`.
- `backend/src/presentation/routes/redeem.routes.ts` — `POST /redeem`.
- `backend/src/presentation/schemas/redeem.schemas.ts` — zod bodies.
- `backend/tests/fakes/InMemoryRedeemCodeRepository.ts`.
- Test files (one per task, listed inline).

**Backend — modify:**
- `backend/prisma/schema.prisma` — 3 new models + 2 back-relations.
- `backend/src/presentation/middleware/errorHandler.ts` — 7 new status mappings.
- `backend/src/presentation/routes/admin.routes.ts` — 3 admin code routes.
- `backend/src/app.ts` — wire repo + 4 use cases + router.

**Frontend — create:**
- `frontend/src/components/redeem-modal.tsx` — player GSAP modal.
- `frontend/src/lib/redeem-validation.ts` — client-side draft validation.
- `frontend/src/app/admin/codes/page.tsx` — admin master/detail editor.

**Frontend — modify:**
- `frontend/src/lib/types.ts` — `RedeemResult`, `AdminRedeemCodeDTO`, `RedeemRewardDTO`.
- `frontend/src/lib/api.ts` — `redeemCode`, `fetchAdminCodes`, `createAdminCode`, `updateAdminCode`.
- `frontend/src/components/icons.tsx` — `GiftIcon`.
- `frontend/src/components/header-menu.tsx` — "Nhập Code" item + `onOpenRedeem` prop.
- `frontend/src/app/page.tsx` — redeem-modal state + wiring.
- `frontend/src/app/admin/layout.tsx` — nav link.

---

### Task 1: Prisma schema — RedeemCode / RedeemCodeReward / Redemption

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Test: `backend/tests/integration/redeem-schema.test.ts`

**Interfaces:**
- Consumes: existing `Pill`, `User` models.
- Produces: Prisma models `RedeemCode` (id, code unique, active, maxRedemptions, redeemedCount, expiresAt, createdAt), `RedeemCodeReward` (id, codeId, pillId, quantity, `@@unique([codeId, pillId])`), `Redemption` (id, codeId, userId, redeemedAt, `@@unique([codeId, userId])`). Prisma client accessors `prisma.redeemCode`, `prisma.redeemCodeReward`, `prisma.redemption`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/integration/redeem-schema.test.ts
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('redeem schema', () => {
  beforeEach(async () => {
    await prisma.redemption.deleteMany();
    await prisma.redeemCodeReward.deleteMany();
    await prisma.redeemCode.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.character.deleteMany();
    await prisma.user.deleteMany();
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
  });

  afterAll(async () => {
    await prisma.redemption.deleteMany();
    await prisma.redeemCodeReward.deleteMany();
    await prisma.redeemCode.deleteMany();
    await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-' } } });
    await prisma.$disconnect();
  });

  it('creates a code with a reward and a redemption, enforcing per-user uniqueness', async () => {
    await prisma.pill.create({ data: { id: 'test-p', name: 'P', glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, desc: 'd', active: true, starterQuantity: 0 } });
    const user = await prisma.user.create({ data: { username: 'zoe-redeem', passwordHash: 'h' } });
    const code = await prisma.redeemCode.create({
      data: { code: 'TEST2026', active: true, maxRedemptions: 5, rewards: { create: [{ pillId: 'test-p', quantity: 3 }] } },
      include: { rewards: true },
    });
    expect(code.redeemedCount).toBe(0);
    expect(code.rewards[0].quantity).toBe(3);

    await prisma.redemption.create({ data: { codeId: code.id, userId: user.id } });
    await expect(
      prisma.redemption.create({ data: { codeId: code.id, userId: user.id } }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/redeem-schema.test.ts`
Expected: FAIL — `prisma.redeemCode` is undefined (model does not exist yet).

- [ ] **Step 3: Add the models to the schema**

Append to `backend/prisma/schema.prisma` and add the two back-relations to existing models.

```prisma
model RedeemCode {
  id             String   @id @default(uuid())
  code           String   @unique
  active         Boolean  @default(true)
  maxRedemptions Int
  redeemedCount  Int      @default(0)
  expiresAt      DateTime?
  createdAt      DateTime @default(now())
  rewards        RedeemCodeReward[]
  redemptions    Redemption[]
}

model RedeemCodeReward {
  id       String     @id @default(uuid())
  codeId   String
  code     RedeemCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  pillId   String
  pill     Pill       @relation(fields: [pillId], references: [id])
  quantity Int
  @@unique([codeId, pillId])
}

model Redemption {
  id         String     @id @default(uuid())
  codeId     String
  code       RedeemCode @relation(fields: [codeId], references: [id], onDelete: Cascade)
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  redeemedAt DateTime   @default(now())
  @@unique([codeId, userId])
}
```

In `model User { ... }` add: `redemptions Redemption[]`
In `model Pill { ... }` add: `redeemRewards RedeemCodeReward[]`

- [ ] **Step 4: Generate the migration + client**

Run: `cd backend && npx prisma migrate dev --name redeem_code`
Expected: migration `redeem_code` created and applied; client regenerated.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/integration/redeem-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/tests/integration/redeem-schema.test.ts
git commit -m "feat(redeem): add RedeemCode/RedeemCodeReward/Redemption schema"
```

### Task 2: Domain types + validation

**Files:**
- Create: `backend/src/domain/redeem/redeemCode.ts`
- Create: `backend/src/domain/redeem/redeemCode.validate.ts`
- Test: `backend/tests/unit/redeemCode.validate.test.ts`

**Interfaces:**
- Consumes: `DomainError` from `../errors`.
- Produces:
  - `interface RewardEntry { pillId: string; quantity: number }`
  - `interface RedeemCodeRecord { id: string; code: string; active: boolean; maxRedemptions: number; redeemedCount: number; expiresAt: Date | null; rewards: RewardEntry[] }`
  - `interface RedeemResultDto { rewards: Array<{ pillId: string; name: string; glyph: string; quantity: number }> }`
  - `function normalizeCode(code: string): string` (trim + uppercase)
  - `function validateRedeemCodeDefinition(input: { code: string; maxRedemptions: number; expiresAt: Date | null; rewards: RewardEntry[] }): void` — throws `DomainError('INVALID_REDEEM_CODE', ...)`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/unit/redeemCode.validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateRedeemCodeDefinition, normalizeCode } from '../../src/domain/redeem/redeemCode.validate';
import { DomainError } from '../../src/domain/errors';

const base = { code: 'ABC', maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 2 }] };

describe('normalizeCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCode('  abc2026 ')).toBe('ABC2026');
  });
});

describe('validateRedeemCodeDefinition', () => {
  it('accepts a valid definition', () => {
    expect(() => validateRedeemCodeDefinition(base)).not.toThrow();
  });
  it('rejects an empty code', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, code: '   ' })).toThrow(DomainError);
  });
  it('rejects maxRedemptions < 1', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, maxRedemptions: 0 })).toThrow(DomainError);
  });
  it('rejects a non-integer maxRedemptions', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, maxRedemptions: 1.5 })).toThrow(DomainError);
  });
  it('rejects empty rewards', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [] })).toThrow(DomainError);
  });
  it('rejects a reward quantity < 1', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'p1', quantity: 0 }] })).toThrow(DomainError);
  });
  it('rejects a duplicate pillId', () => {
    expect(() => validateRedeemCodeDefinition({ ...base, rewards: [{ pillId: 'p1', quantity: 1 }, { pillId: 'p1', quantity: 2 }] })).toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/redeemCode.validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the types**

```typescript
// backend/src/domain/redeem/redeemCode.ts
export interface RewardEntry {
  pillId: string;
  quantity: number;
}

export interface RedeemCodeRecord {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: Date | null;
  rewards: RewardEntry[];
}

export interface RedeemResultDto {
  rewards: Array<{ pillId: string; name: string; glyph: string; quantity: number }>;
}
```

- [ ] **Step 4: Write the validation**

```typescript
// backend/src/domain/redeem/redeemCode.validate.ts
import { DomainError } from '../errors';
import { RewardEntry } from './redeemCode';

// Case-insensitive matching: the same normalization runs at create AND lookup,
// so what an admin types and what a player types compare equal regardless of case.
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateRedeemCodeDefinition(input: {
  code: string;
  maxRedemptions: number;
  expiresAt: Date | null;
  rewards: RewardEntry[];
}): void {
  if (normalizeCode(input.code) === '') {
    throw new DomainError('INVALID_REDEEM_CODE', 'code must not be empty');
  }
  if (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1) {
    throw new DomainError('INVALID_REDEEM_CODE', 'maxRedemptions must be an integer >= 1');
  }
  if (input.rewards.length === 0) {
    throw new DomainError('INVALID_REDEEM_CODE', 'a code must grant at least one reward');
  }
  const seen = new Set<string>();
  for (const r of input.rewards) {
    if (!Number.isInteger(r.quantity) || r.quantity < 1) {
      throw new DomainError('INVALID_REDEEM_CODE', 'each reward quantity must be an integer >= 1');
    }
    if (seen.has(r.pillId)) {
      throw new DomainError('INVALID_REDEEM_CODE', `duplicate reward for pill "${r.pillId}"`);
    }
    seen.add(r.pillId);
  }
  // expiresAt is intentionally unconstrained: a past date simply means the code
  // is already expired at redeem time (a runtime guard), not a config error.
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/redeemCode.validate.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/redeem backend/tests/unit/redeemCode.validate.test.ts
git commit -m "feat(redeem): add domain types and definition validation"
```

### Task 3: RedeemCodeRepository port + in-memory fake

**Files:**
- Create: `backend/src/domain/ports/RedeemCodeRepository.ts`
- Create: `backend/tests/fakes/InMemoryRedeemCodeRepository.ts`
- Test: `backend/tests/unit/InMemoryRedeemCodeRepository.test.ts`

**Interfaces:**
- Consumes: `RedeemCodeRecord`, `RewardEntry` (Task 2).
- Produces:
  - `type ReserveResult = 'ok' | 'already_redeemed' | 'exhausted'`
  - `interface RedeemCodeRepository { findByCode(code: string): Promise<RedeemCodeRecord | null>; listAll(): Promise<RedeemCodeRecord[]>; create(record: RedeemCodeRecord): Promise<void>; update(record: RedeemCodeRecord): Promise<boolean>; tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult>; grantRewards(userId: string, rewards: RewardEntry[]): Promise<void> }`
  - `InMemoryRedeemCodeRepository` with test helpers `seedCode(record)` and `getInventory(userId): Map<string, number>`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/unit/InMemoryRedeemCodeRepository.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

function code(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'c1', code: 'ABC', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 3 }], ...over };
}

describe('InMemoryRedeemCodeRepository', () => {
  it('finds by code and lists all', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code());
    expect((await repo.findByCode('ABC'))?.id).toBe('c1');
    expect(await repo.listAll()).toHaveLength(1);
  });

  it('reserves once per user, rejecting a second reservation', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code());
    expect(await repo.tryReserveRedemption('c1', 'u1', 2)).toBe('ok');
    expect(await repo.tryReserveRedemption('c1', 'u1', 2)).toBe('already_redeemed');
  });

  it('returns exhausted once the cap is reached', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    repo.seedCode(code({ maxRedemptions: 1 }));
    expect(await repo.tryReserveRedemption('c1', 'u1', 1)).toBe('ok');
    expect(await repo.tryReserveRedemption('c1', 'u2', 1)).toBe('exhausted');
  });

  it('grants rewards additively into inventory', async () => {
    const repo = new InMemoryRedeemCodeRepository();
    await repo.grantRewards('u1', [{ pillId: 'p1', quantity: 3 }, { pillId: 'p2', quantity: 1 }]);
    await repo.grantRewards('u1', [{ pillId: 'p1', quantity: 2 }]);
    expect(repo.getInventory('u1').get('p1')).toBe(5);
    expect(repo.getInventory('u1').get('p2')).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/InMemoryRedeemCodeRepository.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the port**

```typescript
// backend/src/domain/ports/RedeemCodeRepository.ts
import { RedeemCodeRecord, RewardEntry } from '../redeem/redeemCode';

export type ReserveResult = 'ok' | 'already_redeemed' | 'exhausted';

export interface RedeemCodeRepository {
  findByCode(code: string): Promise<RedeemCodeRecord | null>;
  listAll(): Promise<RedeemCodeRecord[]>;
  create(record: RedeemCodeRecord): Promise<void>;
  // Full-row overwrite by id (rewards replaced wholesale). Returns false on unknown id.
  update(record: RedeemCodeRecord): Promise<boolean>;
  // Atomic per-user-once + cap guard. See PrismaRedeemCodeRepository for the
  // DB-enforced implementation; the result tells the use case which error to throw.
  tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult>;
  // Additive grant into inventory (increment-or-create), like seedStarterInventory.
  grantRewards(userId: string, rewards: RewardEntry[]): Promise<void>;
}
```

- [ ] **Step 4: Write the in-memory fake**

```typescript
// backend/tests/fakes/InMemoryRedeemCodeRepository.ts
import { RedeemCodeRepository, ReserveResult } from '../../src/domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../../src/domain/redeem/redeemCode';
import { normalizeCode } from '../../src/domain/redeem/redeemCode.validate';

export class InMemoryRedeemCodeRepository implements RedeemCodeRepository {
  private codes = new Map<string, RedeemCodeRecord>(); // key: id
  private redemptions = new Set<string>(); // key: `${codeId}:${userId}`
  private inv = new Map<string, Map<string, number>>(); // userId -> (pillId -> qty)

  seedCode(record: RedeemCodeRecord): void {
    this.codes.set(record.id, record);
  }

  getInventory(userId: string): Map<string, number> {
    return this.inv.get(userId) ?? new Map();
  }

  async findByCode(code: string): Promise<RedeemCodeRecord | null> {
    const target = normalizeCode(code);
    for (const c of this.codes.values()) {
      if (normalizeCode(c.code) === target) return c;
    }
    return null;
  }

  async listAll(): Promise<RedeemCodeRecord[]> {
    return [...this.codes.values()];
  }

  async create(record: RedeemCodeRecord): Promise<void> {
    this.codes.set(record.id, record);
  }

  async update(record: RedeemCodeRecord): Promise<boolean> {
    if (!this.codes.has(record.id)) return false;
    this.codes.set(record.id, record);
    return true;
  }

  async tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult> {
    const key = `${codeId}:${userId}`;
    if (this.redemptions.has(key)) return 'already_redeemed';
    const c = this.codes.get(codeId);
    if (!c || c.redeemedCount >= maxRedemptions) return 'exhausted';
    this.redemptions.add(key);
    c.redeemedCount += 1;
    return 'ok';
  }

  async grantRewards(userId: string, rewards: RewardEntry[]): Promise<void> {
    const bag = this.inv.get(userId) ?? new Map<string, number>();
    for (const r of rewards) {
      bag.set(r.pillId, (bag.get(r.pillId) ?? 0) + r.quantity);
    }
    this.inv.set(userId, bag);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/InMemoryRedeemCodeRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/ports/RedeemCodeRepository.ts backend/tests/fakes/InMemoryRedeemCodeRepository.ts backend/tests/unit/InMemoryRedeemCodeRepository.test.ts
git commit -m "feat(redeem): add RedeemCodeRepository port and in-memory fake"
```

### Task 4: RedeemCodeUseCase (player redemption)

**Files:**
- Create: `backend/src/application/RedeemCodeUseCase.ts`
- Test: `backend/tests/unit/RedeemCodeUseCase.test.ts`

**Interfaces:**
- Consumes: `RedeemCodeRepository` + `ReserveResult` (Task 3), `PillRepository` (existing — `findById`), `normalizeCode` (Task 2), `RedeemResultDto` (Task 2), `DomainError`.
- Produces: `class RedeemCodeUseCase { constructor(codes: RedeemCodeRepository, pills: PillRepository); execute(input: { userId: string; code: string }): Promise<RedeemResultDto> }`.

Guard order and error codes (each a `DomainError`): not found → `REDEEM_CODE_NOT_FOUND`; `!active` → `REDEEM_CODE_INACTIVE`; expired → `REDEEM_CODE_EXPIRED`; reserve `already_redeemed` → `REDEEM_CODE_ALREADY_USED`; reserve `exhausted` → `REDEEM_CODE_EXHAUSTED`. Reservation happens BEFORE granting. Disabled-pill rewards are granted anyway (spec decision); a reward whose pill row was hard-deleted is skipped for name/glyph enrichment but still granted (fallback name = pillId).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/unit/RedeemCodeUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { RedeemCodeUseCase } from '../../src/application/RedeemCodeUseCase';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { InMemoryPillRepository } from '../fakes/InMemoryPillRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';
import { PillRecord } from '../../src/domain/pills/pill';

function pill(id: string, over: Partial<PillRecord> = {}): PillRecord {
  return { id, name: `N-${id}`, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, multiplier: null, durationSec: null, bonusPct: null, desc: 'd', active: true, starterQuantity: 0, ...over };
}
function code(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'c1', code: 'ABC', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 3 }], ...over };
}

function build() {
  const codes = new InMemoryRedeemCodeRepository();
  const pills = new InMemoryPillRepository();
  pills.seedPill(pill('p1'));
  return { codes, pills, uc: new RedeemCodeUseCase(codes, pills) };
}

describe('RedeemCodeUseCase', () => {
  it('grants the bundle and returns enriched rewards', async () => {
    const { codes, pills, uc } = build();
    codes.seedCode(code());
    const res = await uc.execute({ userId: 'u1', code: 'abc' }); // case-insensitive
    expect(res.rewards).toEqual([{ pillId: 'p1', name: 'N-p1', glyph: 'x', quantity: 3 }]);
    expect(codes.getInventory('u1').get('p1')).toBe(3);
    void pills;
  });

  it('rejects an unknown code with REDEEM_CODE_NOT_FOUND', async () => {
    const { uc } = build();
    await expect(uc.execute({ userId: 'u1', code: 'NOPE' })).rejects.toMatchObject({ code: 'REDEEM_CODE_NOT_FOUND' });
  });

  it('rejects an inactive code', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ active: false }));
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_INACTIVE' });
  });

  it('rejects an expired code', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_EXPIRED' });
  });

  it('rejects a second redemption by the same user', async () => {
    const { codes, uc } = build();
    codes.seedCode(code());
    await uc.execute({ userId: 'u1', code: 'ABC' });
    await expect(uc.execute({ userId: 'u1', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_ALREADY_USED' });
  });

  it('rejects once the cap is reached', async () => {
    const { codes, uc } = build();
    codes.seedCode(code({ maxRedemptions: 1 }));
    await uc.execute({ userId: 'u1', code: 'ABC' });
    await expect(uc.execute({ userId: 'u2', code: 'ABC' })).rejects.toMatchObject({ code: 'REDEEM_CODE_EXHAUSTED' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/RedeemCodeUseCase.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the use case**

```typescript
// backend/src/application/RedeemCodeUseCase.ts
import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { PillRepository } from '../domain/ports/PillRepository';
import { RedeemResultDto } from '../domain/redeem/redeemCode';
import { normalizeCode } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class RedeemCodeUseCase {
  constructor(
    private readonly codes: RedeemCodeRepository,
    private readonly pills: PillRepository,
  ) {}

  async execute(input: { userId: string; code: string }): Promise<RedeemResultDto> {
    const code = await this.codes.findByCode(normalizeCode(input.code));
    if (!code) {
      throw new DomainError('REDEEM_CODE_NOT_FOUND', 'Mã không tồn tại');
    }
    if (!code.active) {
      throw new DomainError('REDEEM_CODE_INACTIVE', 'Mã đã bị vô hiệu hóa');
    }
    if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
      throw new DomainError('REDEEM_CODE_EXPIRED', 'Mã đã hết hạn');
    }

    // Reserve BEFORE granting: the reservation is the single source of truth for
    // "this user gets the bundle exactly once", so a lost cap race never grants.
    const reserved = await this.codes.tryReserveRedemption(code.id, input.userId, code.maxRedemptions);
    if (reserved === 'already_redeemed') {
      throw new DomainError('REDEEM_CODE_ALREADY_USED', 'Bạn đã đổi mã này rồi');
    }
    if (reserved === 'exhausted') {
      throw new DomainError('REDEEM_CODE_EXHAUSTED', 'Mã đã hết lượt đổi');
    }

    await this.codes.grantRewards(input.userId, code.rewards);

    // Enrich each reward with the pill's name/glyph for the success toast. A pill
    // hard-deleted after the code was authored falls back to its id (still granted).
    const rewards = await Promise.all(
      code.rewards.map(async (r) => {
        const pill = await this.pills.findById(r.pillId);
        return { pillId: r.pillId, name: pill?.name ?? r.pillId, glyph: pill?.glyph ?? '?', quantity: r.quantity };
      }),
    );
    return { rewards };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/RedeemCodeUseCase.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/RedeemCodeUseCase.ts backend/tests/unit/RedeemCodeUseCase.test.ts
git commit -m "feat(redeem): add player RedeemCodeUseCase"
```

### Task 5: Admin use cases (List / Create / Update)

**Files:**
- Create: `backend/src/application/ListRedeemCodesUseCase.ts`
- Create: `backend/src/application/CreateRedeemCodeUseCase.ts`
- Create: `backend/src/application/UpdateRedeemCodeUseCase.ts`
- Test: `backend/tests/unit/RedeemCodeAdminUseCases.test.ts`

**Interfaces:**
- Consumes: `RedeemCodeRepository` (Task 3), `normalizeCode` + `validateRedeemCodeDefinition` (Task 2), `DomainError`.
- Produces:
  - `class ListRedeemCodesUseCase { execute(): Promise<RedeemCodeRecord[]> }`
  - `class CreateRedeemCodeUseCase { execute(input: { id: string; code: string; active: boolean; maxRedemptions: number; expiresAt: Date | null; rewards: RewardEntry[] }): Promise<RedeemCodeRecord> }` — throws `REDEEM_CODE_TAKEN` if code already exists after normalization.
  - `class UpdateRedeemCodeUseCase { execute(record: RedeemCodeRecord): Promise<RedeemCodeRecord> }` — throws `REDEEM_CODE_NOT_FOUND` if `update` returns false. `redeemedCount` is passed through unchanged from the caller-supplied record; the `code` string field is stored but immutable by convention (the caller must pass the original code — the route handler reads the id from the URL and fetches the existing record to apply partial edits).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/unit/RedeemCodeAdminUseCases.test.ts
import { describe, it, expect } from 'vitest';
import { ListRedeemCodesUseCase } from '../../src/application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from '../../src/application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from '../../src/application/UpdateRedeemCodeUseCase';
import { InMemoryRedeemCodeRepository } from '../fakes/InMemoryRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

function repo() { return new InMemoryRedeemCodeRepository(); }
const baseInput = { id: 'c1', code: 'abc', active: true, maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'p1', quantity: 2 }] };

describe('ListRedeemCodesUseCase', () => {
  it('returns all codes including inactive', async () => {
    const r = repo();
    r.seedCode({ ...baseInput, code: 'ABC', redeemedCount: 0 });
    r.seedCode({ id: 'c2', code: 'XYZ', active: false, maxRedemptions: 1, redeemedCount: 1, expiresAt: null, rewards: [] });
    const list = await new ListRedeemCodesUseCase(r).execute();
    expect(list).toHaveLength(2);
  });
});

describe('CreateRedeemCodeUseCase', () => {
  it('normalizes the code and creates', async () => {
    const r = repo();
    const created = await new CreateRedeemCodeUseCase(r).execute(baseInput);
    expect(created.code).toBe('ABC'); // normalized
    expect((await r.findByCode('ABC'))?.id).toBe('c1');
  });

  it('throws REDEEM_CODE_TAKEN for a duplicate (case-insensitive)', async () => {
    const r = repo();
    await new CreateRedeemCodeUseCase(r).execute(baseInput);
    await expect(new CreateRedeemCodeUseCase(r).execute({ ...baseInput, id: 'c2' })).rejects.toMatchObject({ code: 'REDEEM_CODE_TAKEN' });
  });

  it('throws INVALID_REDEEM_CODE for invalid input', async () => {
    const r = repo();
    await expect(new CreateRedeemCodeUseCase(r).execute({ ...baseInput, maxRedemptions: 0 })).rejects.toMatchObject({ code: 'INVALID_REDEEM_CODE' });
  });
});

describe('UpdateRedeemCodeUseCase', () => {
  it('updates an existing code', async () => {
    const r = repo();
    const created = await new CreateRedeemCodeUseCase(r).execute(baseInput);
    const updated = await new UpdateRedeemCodeUseCase(r).execute({ ...created, maxRedemptions: 10 });
    expect(updated.maxRedemptions).toBe(10);
  });

  it('throws REDEEM_CODE_NOT_FOUND for an unknown id', async () => {
    const r = repo();
    const ghost: RedeemCodeRecord = { id: 'ghost', code: 'GHOST', active: true, maxRedemptions: 1, redeemedCount: 0, expiresAt: null, rewards: [] };
    await expect(new UpdateRedeemCodeUseCase(r).execute(ghost)).rejects.toMatchObject({ code: 'REDEEM_CODE_NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/RedeemCodeAdminUseCases.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the three use cases**

```typescript
// backend/src/application/ListRedeemCodesUseCase.ts
import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord } from '../domain/redeem/redeemCode';

export class ListRedeemCodesUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}
  async execute(): Promise<RedeemCodeRecord[]> {
    return this.codes.listAll();
  }
}
```

```typescript
// backend/src/application/CreateRedeemCodeUseCase.ts
import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../domain/redeem/redeemCode';
import { validateRedeemCodeDefinition, normalizeCode } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class CreateRedeemCodeUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}

  async execute(input: {
    id: string;
    code: string;
    active: boolean;
    maxRedemptions: number;
    expiresAt: Date | null;
    rewards: RewardEntry[];
  }): Promise<RedeemCodeRecord> {
    const normalized = normalizeCode(input.code);
    validateRedeemCodeDefinition({ code: normalized, maxRedemptions: input.maxRedemptions, expiresAt: input.expiresAt, rewards: input.rewards });
    const existing = await this.codes.findByCode(normalized);
    if (existing) {
      throw new DomainError('REDEEM_CODE_TAKEN', `Mã "${normalized}" đã tồn tại`);
    }
    const record: RedeemCodeRecord = { ...input, code: normalized, redeemedCount: 0 };
    await this.codes.create(record);
    return record;
  }
}
```

```typescript
// backend/src/application/UpdateRedeemCodeUseCase.ts
import { RedeemCodeRepository } from '../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord } from '../domain/redeem/redeemCode';
import { validateRedeemCodeDefinition } from '../domain/redeem/redeemCode.validate';
import { DomainError } from '../domain/errors';

export class UpdateRedeemCodeUseCase {
  constructor(private readonly codes: RedeemCodeRepository) {}

  async execute(record: RedeemCodeRecord): Promise<RedeemCodeRecord> {
    // Validate the editable fields; code is immutable so we pass the stored value.
    validateRedeemCodeDefinition({ code: record.code, maxRedemptions: record.maxRedemptions, expiresAt: record.expiresAt, rewards: record.rewards });
    const ok = await this.codes.update(record);
    if (!ok) {
      throw new DomainError('REDEEM_CODE_NOT_FOUND', `Mã id "${record.id}" không tồn tại`);
    }
    return record;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/RedeemCodeAdminUseCases.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/ListRedeemCodesUseCase.ts backend/src/application/CreateRedeemCodeUseCase.ts backend/src/application/UpdateRedeemCodeUseCase.ts backend/tests/unit/RedeemCodeAdminUseCases.test.ts
git commit -m "feat(redeem): add admin List/Create/Update use cases"
```

### Task 6: PrismaRedeemCodeRepository + integration tests

**Files:**
- Create: `backend/src/infrastructure/repositories/PrismaRedeemCodeRepository.ts`
- Test: `backend/tests/integration/PrismaRedeemCodeRepository.test.ts`

**Interfaces:**
- Consumes: `RedeemCodeRepository`, `ReserveResult` (Task 3); `RedeemCodeRecord`, `RewardEntry` (Task 2); Prisma client with the `redeemCode`, `redeemCodeReward`, `redemption`, `inventoryItem` accessors from Task 1.
- Produces: `class PrismaRedeemCodeRepository implements RedeemCodeRepository` — concrete implementation used by `app.ts`.

**Key implementation notes:**
- `findByCode` queries `prisma.redeemCode.findUnique({ where: { code } })` with `include: { rewards: true }`.
- `update` uses a Prisma `$transaction([deleteMany({ where: { codeId } }), createMany({ data: rewards })])` to replace rewards wholesale, then `updateMany` for the scalar fields.
- `tryReserveRedemption`: (1) `prisma.redemption.create({ data: { codeId, userId } })` — catch unique-constraint violation (Prisma `PrismaClientKnownRequestError` with code `P2002`) → return `'already_redeemed'`; (2) `prisma.redeemCode.updateMany({ where: { id: codeId, redeemedCount: { lt: maxRedemptions } }, data: { redeemedCount: { increment: 1 } } })` — if `count === 0`, delete the just-inserted Redemption row and return `'exhausted'`; else return `'ok'`.
- `grantRewards`: `prisma.inventoryItem.upsert` per reward — same increment-or-create pattern as `seedStarterInventory`.

- [ ] **Step 1: Write the failing integration test**

```typescript
// backend/tests/integration/PrismaRedeemCodeRepository.test.ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaRedeemCodeRepository } from '../../src/infrastructure/repositories/PrismaRedeemCodeRepository';
import { RedeemCodeRecord } from '../../src/domain/redeem/redeemCode';

const repo = new PrismaRedeemCodeRepository(prisma);

async function seedPill(id: string) {
  await prisma.pill.upsert({ where: { id }, update: {}, create: { id, name: id, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 10, desc: 'd', active: true, starterQuantity: 0 } });
}
async function seedUser(username: string) {
  return prisma.user.create({ data: { username, passwordHash: 'h' } });
}
function codeRecord(over: Partial<RedeemCodeRecord> = {}): RedeemCodeRecord {
  return { id: 'rc-test-1', code: 'PRISMTEST', active: true, maxRedemptions: 2, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: 'test-redeem-p', quantity: 3 }], ...over };
}

beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'PRISM' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'PRISM' } } });
  await prisma.inventoryItem.deleteMany({ where: { user: { username: { startsWith: 'rc-user-' } } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: 'rc-user-' } } });
});

afterAll(async () => {
  await prisma.pill.deleteMany({ where: { id: { startsWith: 'test-redeem-' } } });
  await prisma.$disconnect();
});

describe('PrismaRedeemCodeRepository', () => {
  it('create + findByCode round-trip', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const found = await repo.findByCode('PRISMTEST');
    expect(found?.id).toBe('rc-test-1');
    expect(found?.rewards[0].quantity).toBe(3);
  });

  it('listAll includes inactive', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ id: 'rc-test-2', code: 'PRISMTEST2', active: false }));
    const all = await repo.listAll();
    expect(all.find((c) => c.id === 'rc-test-2')?.active).toBe(false);
  });

  it('update replaces scalar fields and rewards wholesale', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const ok = await repo.update({ ...codeRecord(), maxRedemptions: 99, rewards: [] });
    expect(ok).toBe(true);
    const updated = await repo.findByCode('PRISMTEST');
    expect(updated?.maxRedemptions).toBe(99);
    expect(updated?.rewards).toHaveLength(0);
  });

  it('update returns false for unknown id', async () => {
    const ok = await repo.update({ ...codeRecord(), id: 'no-such-id' });
    expect(ok).toBe(false);
  });

  it('tryReserveRedemption: ok → already_redeemed for same user', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord());
    const u = await seedUser('rc-user-a');
    expect(await repo.tryReserveRedemption('rc-test-1', u.id, 2)).toBe('ok');
    expect(await repo.tryReserveRedemption('rc-test-1', u.id, 2)).toBe('already_redeemed');
  });

  it('tryReserveRedemption: exhausted when cap reached', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ maxRedemptions: 1 }));
    const u1 = await seedUser('rc-user-b');
    const u2 = await seedUser('rc-user-c');
    expect(await repo.tryReserveRedemption('rc-test-1', u1.id, 1)).toBe('ok');
    expect(await repo.tryReserveRedemption('rc-test-1', u2.id, 1)).toBe('exhausted');
  });

  it('concurrent double-redeem: exactly one ok and one exhausted (race test)', async () => {
    await seedPill('test-redeem-p');
    await repo.create(codeRecord({ id: 'rc-test-race', code: 'PRISMRACE', maxRedemptions: 1 }));
    const u1 = await seedUser('rc-user-race1');
    const u2 = await seedUser('rc-user-race2');
    // Pre-warm connections like breakthrough race test, then race two reservations.
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
    const [r1, r2] = await Promise.all([
      repo.tryReserveRedemption('rc-test-race', u1.id, 1),
      repo.tryReserveRedemption('rc-test-race', u2.id, 1),
    ]);
    const results = [r1, r2].sort();
    expect(results).toEqual(['exhausted', 'ok']);
  });

  it('grantRewards upserts additively', async () => {
    await seedPill('test-redeem-p');
    const u = await seedUser('rc-user-d');
    await repo.grantRewards(u.id, [{ pillId: 'test-redeem-p', quantity: 3 }]);
    await repo.grantRewards(u.id, [{ pillId: 'test-redeem-p', quantity: 2 }]);
    const item = await prisma.inventoryItem.findFirst({ where: { userId: u.id, pillId: 'test-redeem-p' } });
    expect(item?.quantity).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/PrismaRedeemCodeRepository.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the Prisma repository**

```typescript
// backend/src/infrastructure/repositories/PrismaRedeemCodeRepository.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { RedeemCodeRepository, ReserveResult } from '../../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../../domain/redeem/redeemCode';

function toRecord(row: { id: string; code: string; active: boolean; maxRedemptions: number; redeemedCount: number; expiresAt: Date | null; createdAt: Date; rewards: Array<{ pillId: string; quantity: number }> }): RedeemCodeRecord {
  return { id: row.id, code: row.code, active: row.active, maxRedemptions: row.maxRedemptions, redeemedCount: row.redeemedCount, expiresAt: row.expiresAt, rewards: row.rewards.map((r) => ({ pillId: r.pillId, quantity: r.quantity })) };
}

export class PrismaRedeemCodeRepository implements RedeemCodeRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByCode(code: string): Promise<RedeemCodeRecord | null> {
    const row = await this.client.redeemCode.findUnique({ where: { code }, include: { rewards: true } });
    return row ? toRecord(row) : null;
  }

  async listAll(): Promise<RedeemCodeRecord[]> {
    const rows = await this.client.redeemCode.findMany({ include: { rewards: true }, orderBy: { createdAt: 'desc' } });
    return rows.map(toRecord);
  }

  async create(record: RedeemCodeRecord): Promise<void> {
    const { rewards, ...scalars } = record;
    await this.client.redeemCode.create({
      data: { ...scalars, rewards: { create: rewards.map((r) => ({ pillId: r.pillId, quantity: r.quantity })) } },
    });
  }

  async update(record: RedeemCodeRecord): Promise<boolean> {
    const { id, rewards, ...scalars } = record;
    // Replace rewards wholesale inside a single transaction so the set is never
    // partially written (same pattern as PrismaRealmConfigRepository.replaceAll).
    try {
      await this.client.$transaction([
        this.client.redeemCodeReward.deleteMany({ where: { codeId: id } }),
        this.client.redeemCodeReward.createMany({ data: rewards.map((r) => ({ codeId: id, pillId: r.pillId, quantity: r.quantity })) }),
        this.client.redeemCode.updateMany({ where: { id }, data: scalars }),
      ]);
    } catch (e) {
      // If the redeemCode row doesn't exist, updateMany returns count 0; detect
      // this by re-reading rather than catching a specific Prisma code.
      const exists = await this.client.redeemCode.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return false;
      throw e;
    }
    const updated = await this.client.redeemCode.findUnique({ where: { id }, select: { id: true } });
    return updated !== null;
  }

  async tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult> {
    // Step 1: Insert the Redemption row. The @@unique([codeId, userId]) constraint
    // fires immediately if this user already redeemed — no read-then-write race.
    try {
      await this.client.redemption.create({ data: { codeId, userId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return 'already_redeemed';
      }
      throw e;
    }
    // Step 2: Atomically increment the counter, guarded on the cap.
    const result = await this.client.redeemCode.updateMany({
      where: { id: codeId, redeemedCount: { lt: maxRedemptions } },
      data: { redeemedCount: { increment: 1 } },
    });
    if (result.count === 0) {
      // Cap already reached: compensate by removing the reservation we just inserted.
      await this.client.redemption.deleteMany({ where: { codeId, userId } });
      return 'exhausted';
    }
    return 'ok';
  }

  async grantRewards(userId: string, rewards: RewardEntry[]): Promise<void> {
    for (const r of rewards) {
      await this.client.inventoryItem.upsert({
        where: { userId_pillId: { userId, pillId: r.pillId } },
        create: { userId, pillId: r.pillId, quantity: r.quantity },
        update: { quantity: { increment: r.quantity } },
      });
    }
  }
}
```

- [ ] **Step 4: Fix the `update` method**

The transaction-based update needs a cleaner approach. Replace the `update` method body:

```typescript
async update(record: RedeemCodeRecord): Promise<boolean> {
  const { id, rewards, ...scalars } = record;
  const exists = await this.client.redeemCode.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return false;
  // Replace rewards wholesale inside a single transaction.
  await this.client.$transaction([
    this.client.redeemCodeReward.deleteMany({ where: { codeId: id } }),
    this.client.redeemCodeReward.createMany({ data: rewards.map((r) => ({ codeId: id, pillId: r.pillId, quantity: r.quantity })) }),
    this.client.redeemCode.update({ where: { id }, data: scalars }),
  ]);
  return true;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/integration/PrismaRedeemCodeRepository.test.ts`
Expected: PASS (8 tests). The race test should pass consistently; if it flakes, re-run once. If it fails repeatedly, add a second pre-warm query per the breakthrough-race pattern.

- [ ] **Step 6: Run the full test suite**

Run: `cd backend && npm test`
Expected: all prior tests still pass, 8 new from this task.

- [ ] **Step 7: Commit**

```bash
git add backend/src/infrastructure/repositories/PrismaRedeemCodeRepository.ts backend/tests/integration/PrismaRedeemCodeRepository.test.ts
git commit -m "feat(redeem): add PrismaRedeemCodeRepository with atomic reservation"
```

### Task 7: Error handler + zod schemas + routes + app.ts wiring

**Files:**
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Create: `backend/src/presentation/schemas/redeem.schemas.ts`
- Create: `backend/src/presentation/routes/redeem.routes.ts`
- Modify: `backend/src/presentation/routes/admin.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/errorHandler.test.ts` (extend existing), `backend/tests/integration/redeem.routes.test.ts`, `backend/tests/integration/admin.codes.test.ts`

**Interfaces:**
- Consumes: `RedeemCodeUseCase` (Task 4), `ListRedeemCodesUseCase` + `CreateRedeemCodeUseCase` + `UpdateRedeemCodeUseCase` (Task 5), `PrismaRedeemCodeRepository` (Task 6), `requireAuth` + `requireAdmin`, `AuthedRequest`, `DomainError`, existing `AppOverrides`.
- Produces: `POST /redeem` (player, auth required); `GET /admin/codes`, `POST /admin/codes`, `PUT /admin/codes/:id` (admin).

- [ ] **Step 1: Extend errorHandler with the 7 new codes**

In `backend/src/presentation/middleware/errorHandler.ts`, add to `STATUS_BY_CODE`:

```typescript
  REDEEM_CODE_NOT_FOUND: 404,
  REDEEM_CODE_INACTIVE: 400,
  REDEEM_CODE_EXPIRED: 400,
  REDEEM_CODE_ALREADY_USED: 409,
  REDEEM_CODE_EXHAUSTED: 409,
  REDEEM_CODE_TAKEN: 409,
  INVALID_REDEEM_CODE: 400,
```

- [ ] **Step 2: Extend the errorHandler test**

In `backend/tests/unit/errorHandler.test.ts`, add at the end of the existing describe block:

```typescript
  it('maps REDEEM_CODE_NOT_FOUND to 404', () => {
    const err = new DomainError('REDEEM_CODE_NOT_FOUND', 'not found');
    errorHandler(err, req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('maps REDEEM_CODE_ALREADY_USED to 409', () => {
    const err = new DomainError('REDEEM_CODE_ALREADY_USED', 'already used');
    errorHandler(err, req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  it('maps INVALID_REDEEM_CODE to 400', () => {
    const err = new DomainError('INVALID_REDEEM_CODE', 'bad config');
    errorHandler(err, req as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
```

Run: `cd backend && npx vitest run tests/unit/errorHandler.test.ts`
Expected: PASS (all existing + 3 new).

- [ ] **Step 3: Write the zod schemas**

```typescript
// backend/src/presentation/schemas/redeem.schemas.ts
import { z } from 'zod';

export const redeemCodeSchema = z.object({
  code: z.string().min(1),
});

const rewardSchema = z.object({
  pillId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const redeemCodeBodySchema = z.object({
  active: z.boolean(),
  maxRedemptions: z.number().int().min(1),
  expiresAt: z.string().datetime().nullable(),
  rewards: z.array(rewardSchema).min(1),
});

// POST carries the id (kebab-case slug, immutable afterwards).
export const createRedeemCodeSchema = redeemCodeBodySchema.extend({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'id must be a kebab-case slug'),
  code: z.string().min(1),
});

// PUT takes id from the URL; body has no id or code (both immutable).
export const updateRedeemCodeSchema = redeemCodeBodySchema;
```

- [ ] **Step 4: Write the player redeem router**

```typescript
// backend/src/presentation/routes/redeem.routes.ts
import { Router, RequestHandler } from 'express';
import { RedeemCodeUseCase } from '../../application/RedeemCodeUseCase';
import { AuthedRequest } from '../middleware/auth';
import { redeemCodeSchema } from '../schemas/redeem.schemas';
import { DomainError } from '../../domain/errors';

export interface RedeemRouterDeps {
  redeemCodeUseCase: RedeemCodeUseCase;
  requireAuth: RequestHandler;
}

export function createRedeemRouter(deps: RedeemRouterDeps): Router {
  const router = Router();

  router.post('/', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const parsed = redeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', 'code is required');
      }
      const result = await deps.redeemCodeUseCase.execute({
        userId: req.userId as string,
        code: parsed.data.code,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 5: Add admin code routes to admin.routes.ts**

Add the following imports at the top of `backend/src/presentation/routes/admin.routes.ts`:

```typescript
import { ListRedeemCodesUseCase } from '../../application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from '../../application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from '../../application/UpdateRedeemCodeUseCase';
import { createRedeemCodeSchema, updateRedeemCodeSchema } from '../schemas/redeem.schemas';
```

Add to the `AdminRouterDeps` interface:

```typescript
  listRedeemCodesUseCase: ListRedeemCodesUseCase;
  createRedeemCodeUseCase: CreateRedeemCodeUseCase;
  updateRedeemCodeUseCase: UpdateRedeemCodeUseCase;
```

Add at the bottom of `createAdminRouter`, before `return router`:

```typescript
  router.get('/codes', async (_req, res, next) => {
    try {
      res.status(200).json({ codes: await deps.listRedeemCodesUseCase.execute() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/codes', async (req, res, next) => {
    try {
      const parsed = createRedeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REDEEM_CODE', parsed.error.issues[0].message);
      }
      const saved = await deps.createRedeemCodeUseCase.execute({
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      });
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });

  router.put('/codes/:id', async (req, res, next) => {
    try {
      const parsed = updateRedeemCodeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_REDEEM_CODE', parsed.error.issues[0].message);
      }
      // id and code are immutable: fetch the existing record and merge edits.
      const existing = await deps.listRedeemCodesUseCase.execute();
      const current = existing.find((c) => c.id === req.params.id);
      if (!current) {
        throw new DomainError('REDEEM_CODE_NOT_FOUND', `id "${req.params.id}" not found`);
      }
      const saved = await deps.updateRedeemCodeUseCase.execute({
        ...current,
        active: parsed.data.active,
        maxRedemptions: parsed.data.maxRedemptions,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        rewards: parsed.data.rewards,
      });
      res.status(200).json(saved);
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 6: Wire into app.ts**

Add imports:

```typescript
import { PrismaRedeemCodeRepository } from './infrastructure/repositories/PrismaRedeemCodeRepository';
import { RedeemCodeUseCase } from './application/RedeemCodeUseCase';
import { ListRedeemCodesUseCase } from './application/ListRedeemCodesUseCase';
import { CreateRedeemCodeUseCase } from './application/CreateRedeemCodeUseCase';
import { UpdateRedeemCodeUseCase } from './application/UpdateRedeemCodeUseCase';
import { createRedeemRouter } from './presentation/routes/redeem.routes';
```

After the `pillRepository` line, add:

```typescript
  const redeemCodeRepository = new PrismaRedeemCodeRepository(client);
```

After the existing use-case instantiations, add:

```typescript
  const redeemCodeUseCase = new RedeemCodeUseCase(redeemCodeRepository, pillRepository);
  const listRedeemCodesUseCase = new ListRedeemCodesUseCase(redeemCodeRepository);
  const createRedeemCodeUseCase = new CreateRedeemCodeUseCase(redeemCodeRepository);
  const updateRedeemCodeUseCase = new UpdateRedeemCodeUseCase(redeemCodeRepository);
```

Add the router mount after `/pills`:

```typescript
  app.use('/redeem', createRedeemRouter({ redeemCodeUseCase, requireAuth }));
```

Update the `createAdminRouter` call to pass the three new use cases:

```typescript
  app.use(
    '/admin',
    createAdminRouter({ updateRealmConfigUseCase, getAdminStatsUseCase, listPillsAdminUseCase, createPillUseCase, updatePillUseCase, realmConfigSource: realmConfigProvider, realmConfigReloader: realmConfigProvider, listRedeemCodesUseCase, createRedeemCodeUseCase, updateRedeemCodeUseCase, requireAuth }),
  );
```

- [ ] **Step 7: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Write the integration tests**

```typescript
// backend/tests/integration/redeem.routes.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}
async function registerAdminAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}

function redeemBody(over: Record<string, unknown> = {}) {
  return { id: 'rt-code-1', code: 'RTEST', active: true, maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 2 }], ...over };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'RTEST' } } });
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'RTEST' } } });
  await prisma.$disconnect();
});

describe('POST /redeem', () => {
  it('returns 401 without auth', async () => {
    expect((await request(app).post('/redeem').send({ code: 'X' })).status).toBe(401);
  });

  it('returns 404 for unknown code', async () => {
    const cookies = await registerAndLogin('rtu1');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'UNKNOWN' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REDEEM_CODE_NOT_FOUND');
  });

  it('grants rewards and returns enriched result', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody());
    const cookies = await registerAndLogin('rt-player');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'rtest' }); // lowercase — normalized
    expect(res.status).toBe(200);
    expect(res.body.rewards[0].pillId).toBe('hoi-khi-dan');
    expect(res.body.rewards[0].quantity).toBe(2);
    const inv = await request(app).get('/pills/inventory').set('Cookie', cookies);
    const item = inv.body.find((i: { id: string }) => i.id === 'hoi-khi-dan');
    expect(item?.quantity).toBeGreaterThanOrEqual(2);
  });

  it('returns 409 REDEEM_CODE_ALREADY_USED on second attempt', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin2');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody());
    const cookies = await registerAndLogin('rt-player2');
    await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    const res2 = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('REDEEM_CODE_ALREADY_USED');
  });

  it('returns 409 REDEEM_CODE_EXHAUSTED when cap reached', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin3');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody({ maxRedemptions: 1 }));
    const c1 = await registerAndLogin('rt-p3a');
    const c2 = await registerAndLogin('rt-p3b');
    await request(app).post('/redeem').set('Cookie', c1).send({ code: 'RTEST' });
    const res = await request(app).post('/redeem').set('Cookie', c2).send({ code: 'RTEST' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REDEEM_CODE_EXHAUSTED');
  });
});
```

```typescript
// backend/tests/integration/admin.codes.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}
async function registerAdminAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}

function codeBody(over: Record<string, unknown> = {}) {
  return { id: 'ac-code-1', code: 'ACTEST', active: true, maxRedemptions: 3, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 1 }], ...over };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});
beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'ACTEST' } } });
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'ACTEST' } } });
  await prisma.$disconnect();
});

describe('/admin/codes', () => {
  it('rejects a non-admin with 403', async () => {
    const cookies = await registerAndLogin('ac-user');
    expect((await request(app).get('/admin/codes').set('Cookie', cookies)).status).toBe(403);
  });

  it('admin CRUD: create → list → update → list', async () => {
    const cookies = await registerAdminAndLogin('ac-admin');
    const post = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody());
    expect(post.status).toBe(201);
    expect(post.body.code).toBe('ACTEST');

    const list = await request(app).get('/admin/codes').set('Cookie', cookies);
    expect(list.status).toBe(200);
    expect(list.body.codes.some((c: { id: string }) => c.id === 'ac-code-1')).toBe(true);

    const put = await request(app).put('/admin/codes/ac-code-1').set('Cookie', cookies).send({ active: false, maxRedemptions: 10, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 5 }] });
    expect(put.status).toBe(200);
    expect(put.body.active).toBe(false);
    expect(put.body.maxRedemptions).toBe(10);
  });

  it('returns 409 REDEEM_CODE_TAKEN for duplicate code', async () => {
    const cookies = await registerAdminAndLogin('ac-admin2');
    await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody());
    const res = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody({ id: 'ac-code-2' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REDEEM_CODE_TAKEN');
  });

  it('returns 400 INVALID_REDEEM_CODE for bad maxRedemptions', async () => {
    const cookies = await registerAdminAndLogin('ac-admin3');
    const res = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody({ maxRedemptions: 0 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 9: Run the integration tests**

Run: `cd backend && npx vitest run tests/integration/redeem.routes.test.ts tests/integration/admin.codes.test.ts`
Expected: PASS.

- [ ] **Step 10: Run the full test suite**

Run: `cd backend && npm test`
Expected: all tests pass (count will reflect all new tests from Tasks 1–7).

- [ ] **Step 11: Commit**

```bash
git add backend/src/presentation backend/src/infrastructure/repositories/PrismaRedeemCodeRepository.ts backend/src/app.ts backend/tests/unit/errorHandler.test.ts backend/tests/integration/redeem.routes.test.ts backend/tests/integration/admin.codes.test.ts
git commit -m "feat(redeem): wire presentation layer, app.ts, integration tests"
```

### Task 8: Frontend types + api + validation

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/redeem-validation.ts`
- Test: `frontend/src/lib/api.test.ts` (extend), `frontend/src/lib/redeem-validation.test.ts` (new)

**Interfaces:**
- Consumes: existing `apiFetch`, `AdminPillDTO`.
- Produces:
  - `interface RedeemRewardDTO { pillId: string; name: string; glyph: string; quantity: number }`
  - `interface RedeemResult { rewards: RedeemRewardDTO[] }`
  - `interface AdminRedeemCodeDTO { id: string; code: string; active: boolean; maxRedemptions: number; redeemedCount: number; expiresAt: string | null; rewards: Array<{ pillId: string; quantity: number }> }`
  - `function redeemCode(code: string): Promise<RedeemResult>`
  - `function fetchAdminCodes(): Promise<{ codes: AdminRedeemCodeDTO[] }>`
  - `function createAdminCode(body: Omit<AdminRedeemCodeDTO, 'redeemedCount'>): Promise<AdminRedeemCodeDTO>`
  - `function updateAdminCode(id: string, body: Omit<AdminRedeemCodeDTO, 'id' | 'code' | 'redeemedCount'>): Promise<AdminRedeemCodeDTO>`
  - `interface RedeemDraftError { field: string; message: string }`
  - `function validateRedeemDraft(draft: Omit<AdminRedeemCodeDTO, 'redeemedCount'>, opts: { isNew: boolean }): RedeemDraftError[]`
  - `function findRedeemError(errors: RedeemDraftError[], field: string): RedeemDraftError | undefined`

- [ ] **Step 1: Add types to types.ts**

Append to `frontend/src/lib/types.ts`:

```typescript
export interface RedeemRewardDTO {
  pillId: string;
  name: string;
  glyph: string;
  quantity: number;
}

export interface RedeemResult {
  rewards: RedeemRewardDTO[];
}

export interface AdminRedeemCodeDTO {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string | null; // ISO 8601 or null
  rewards: Array<{ pillId: string; quantity: number }>;
}
```

- [ ] **Step 2: Add api functions to api.ts**

Add the import for the new types at the top of `frontend/src/lib/api.ts`:

```typescript
import type {
  AdminPillDTO,
  AdminRedeemCodeDTO,
  AdminStats,
  ApiError,
  CultivationState,
  Me,
  PillInventoryItem,
  RealmConfigDTO,
  RedeemResult,
} from "./types";
```

Append the four functions at the bottom of `frontend/src/lib/api.ts` (before the `export { API_BASE }` line):

```typescript
// POST /redeem — player exchanges a code for pills.
export function redeemCode(code: string): Promise<RedeemResult> {
  return apiFetch<RedeemResult>("/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// GET /admin/codes — full catalog including inactive.
export function fetchAdminCodes(): Promise<{ codes: AdminRedeemCodeDTO[] }> {
  return apiFetch<{ codes: AdminRedeemCodeDTO[] }>("/admin/codes");
}

// POST /admin/codes — create a new code.
export function createAdminCode(
  body: Omit<AdminRedeemCodeDTO, "redeemedCount">,
): Promise<AdminRedeemCodeDTO> {
  return apiFetch<AdminRedeemCodeDTO>("/admin/codes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// PUT /admin/codes/:id — full-row update; id and code travel in URL/existing record only.
export function updateAdminCode(
  id: string,
  body: Omit<AdminRedeemCodeDTO, "id" | "code" | "redeemedCount">,
): Promise<AdminRedeemCodeDTO> {
  return apiFetch<AdminRedeemCodeDTO>(`/admin/codes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 3: Write the validation test**

```typescript
// frontend/src/lib/redeem-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateRedeemDraft, findRedeemError } from "./redeem-validation";
import type { AdminRedeemCodeDTO } from "./types";

function draft(over: Partial<AdminRedeemCodeDTO> = {}): AdminRedeemCodeDTO {
  return { id: "abc-code", code: "TEST2026", active: true, maxRedemptions: 5, redeemedCount: 0, expiresAt: null, rewards: [{ pillId: "p1", quantity: 2 }], ...over };
}

describe("validateRedeemDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateRedeemDraft(draft(), { isNew: true })).toHaveLength(0);
  });
  it("rejects a non-slug id on create", () => {
    const errors = validateRedeemDraft(draft({ id: "Bad ID" }), { isNew: true });
    expect(findRedeemError(errors, "id")).toBeDefined();
  });
  it("skips id validation on edit", () => {
    const errors = validateRedeemDraft(draft({ id: "Bad ID" }), { isNew: false });
    expect(findRedeemError(errors, "id")).toBeUndefined();
  });
  it("rejects empty code", () => {
    const errors = validateRedeemDraft(draft({ code: "  " }), { isNew: true });
    expect(findRedeemError(errors, "code")).toBeDefined();
  });
  it("rejects maxRedemptions < 1", () => {
    const errors = validateRedeemDraft(draft({ maxRedemptions: 0 }), { isNew: true });
    expect(findRedeemError(errors, "maxRedemptions")).toBeDefined();
  });
  it("rejects NaN maxRedemptions (from empty input)", () => {
    const errors = validateRedeemDraft(draft({ maxRedemptions: NaN }), { isNew: true });
    expect(findRedeemError(errors, "maxRedemptions")).toBeDefined();
  });
  it("rejects empty rewards", () => {
    const errors = validateRedeemDraft(draft({ rewards: [] }), { isNew: true });
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });
  it("rejects reward quantity < 1", () => {
    const errors = validateRedeemDraft(draft({ rewards: [{ pillId: "p1", quantity: 0 }] }), { isNew: true });
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });
  it("rejects duplicate pillId in rewards", () => {
    const errors = validateRedeemDraft(draft({ rewards: [{ pillId: "p1", quantity: 1 }, { pillId: "p1", quantity: 2 }] }), { isNew: true });
    expect(findRedeemError(errors, "rewards")).toBeDefined();
  });
});
```

Run: `cd frontend && pnpm test -- redeem-validation`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the validation module**

```typescript
// frontend/src/lib/redeem-validation.ts
import type { AdminRedeemCodeDTO } from "./types";

export interface RedeemDraftError {
  field: string;
  message: string;
}

export function validateRedeemDraft(
  draft: Omit<AdminRedeemCodeDTO, "redeemedCount">,
  opts: { isNew: boolean },
): RedeemDraftError[] {
  const errors: RedeemDraftError[] = [];
  const fail = (field: string, message: string) => errors.push({ field, message });

  if (opts.isNew && !/^[a-z0-9-]+$/.test(draft.id)) {
    fail("id", "Chỉ gồm a-z, 0-9 và dấu gạch ngang");
  }
  if (draft.code.trim() === "") {
    fail("code", "Mã không được để trống");
  }
  if (!Number.isInteger(draft.maxRedemptions) || draft.maxRedemptions < 1) {
    fail("maxRedemptions", "Số nguyên ≥ 1");
  }
  if (draft.rewards.length === 0) {
    fail("rewards", "Phải có ít nhất một phần thưởng");
  } else {
    const seen = new Set<string>();
    for (const r of draft.rewards) {
      if (!Number.isInteger(r.quantity) || r.quantity < 1) {
        fail("rewards", "Số lượng mỗi đan dược phải là số nguyên ≥ 1");
        break;
      }
      if (seen.has(r.pillId)) {
        fail("rewards", `Pill "${r.pillId}" bị trùng`);
        break;
      }
      seen.add(r.pillId);
    }
  }
  return errors;
}

export function findRedeemError(
  errors: RedeemDraftError[],
  field: string,
): RedeemDraftError | undefined {
  return errors.find((e) => e.field === field);
}
```

- [ ] **Step 5: Add api stub tests**

Append to `frontend/src/lib/api.test.ts` (after the last describe block, before EOF):

```typescript
describe("redeem api", () => {
  it("redeemCode POSTs the code and returns rewards", async () => {
    const result = { rewards: [{ pillId: "p1", name: "Pill", glyph: "x", quantity: 3 }] };
    const fetchMock = vi.fn(async () => jsonResponse(200, result));
    vi.stubGlobal("fetch", fetchMock);
    const { redeemCode } = await import("./api");
    const data = await redeemCode("TEST2026");
    expect(data.rewards[0].pillId).toBe("p1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/redeem");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ code: "TEST2026" });
  });

  it("fetchAdminCodes GETs /admin/codes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { codes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminCodes } = await import("./api");
    const data = await fetchAdminCodes();
    expect(data.codes).toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/codes");
  });

  it("updateAdminCode PUTs to /admin/codes/:id without id/code/redeemedCount in body", async () => {
    const body = { active: true, maxRedemptions: 5, expiresAt: null, rewards: [] };
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: "c1", code: "X", redeemedCount: 0, ...body }));
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminCode } = await import("./api");
    await updateAdminCode("c1", body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/codes/c1");
    expect(init?.method).toBe("PUT");
    const parsed = JSON.parse(init?.body as string);
    expect(parsed.id).toBeUndefined();
    expect(parsed.code).toBeUndefined();
    expect(parsed.redeemedCount).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run all frontend tests**

Run: `cd frontend && pnpm test`
Expected: PASS (prior count + 9 new = 57 total).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/redeem-validation.ts frontend/src/lib/redeem-validation.test.ts frontend/src/lib/api.test.ts
git commit -m "feat(redeem): add frontend types, api functions, and draft validation"
```

### Task 9: Player redeem modal + HeaderMenu wiring

**Files:**
- Modify: `frontend/src/components/icons.tsx` — add `GiftIcon`
- Create: `frontend/src/components/redeem-modal.tsx`
- Modify: `frontend/src/components/header-menu.tsx` — add `onOpenRedeem` prop + "Nhập Code" item
- Modify: `frontend/src/app/page.tsx` — redeem-modal open state + wiring

**Interfaces:**
- Consumes: `redeemCode` from `api.ts` (Task 8), `RedeemResult`/`RedeemRewardDTO` from `types.ts` (Task 8), `ParticleCanvas.spawnBurst`, `addToast` (existing), `refetch` from `useCultivationState` (existing).
- Produces: `<RedeemModal open={bool} onClose={fn} onSuccess={(result) => void} />` GSAP modal; `GiftIcon` SVG component; updated `HeaderMenu` with `onOpenRedeem` prop.

No automated tests for animated components — visual parity is the human-observation gate.

- [ ] **Step 1: Add GiftIcon to icons.tsx**

In `frontend/src/components/icons.tsx`, add after the last exported icon:

```tsx
export function GiftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
```

- [ ] **Step 2: Write the redeem modal**

```tsx
// frontend/src/components/redeem-modal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { redeemCode } from "@/lib/api";
import type { RedeemResult } from "@/lib/types";

interface RedeemModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: RedeemResult) => void;
}

export function RedeemModal({ open, onClose, onSuccess }: RedeemModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Animate in when opened, animate out on close.
  useEffect(() => {
    if (!open || !overlayRef.current || !panelRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    gsap.fromTo(panelRef.current, { opacity: 0, y: 24, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.5)" });
  }, [open]);

  useEffect(() => {
    if (open) { setCode(""); setError(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await redeemCode(code.trim());
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đổi code thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pill-modal-overlay" ref={overlayRef} onClick={onClose} aria-label="Đóng">
      <div
        className="popup-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nhập Code"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 360 }}
      >
        <h2 className="popup-title">Nhập Code</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            className="glass-input"
            type="text"
            placeholder="Nhập mã đổi thưởng..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={loading}
            autoFocus
            autoComplete="off"
            style={{ textTransform: "uppercase" }}
          />
          {error && <p className="text-danger" style={{ margin: 0 }}>{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !code.trim()}
          >
            {loading ? "Đang đổi..." : "Đổi ngay"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update HeaderMenu**

In `frontend/src/components/header-menu.tsx`:

Add `onOpenRedeem: () => void` to `HeaderMenuProps`.

Add a `handleRedeem` callback (same pattern as `handlePills`):

```tsx
  const handleRedeem = useCallback(() => {
    close();
    onOpenRedeem();
  }, [close, onOpenRedeem]);
```

Add the "Nhập Code" button in **both** the desktop and mobile render sections, placed after the Đan Phòng button and before Quản trị:

Desktop inline section:
```tsx
        <button type="button" className="header-action" onClick={handleRedeem}>
          <GiftIcon />
          <span>Nhập Code</span>
        </button>
```

Mobile dropdown section:
```tsx
            <button
              type="button"
              role="menuitem"
              className="header-menu-item"
              onClick={handleRedeem}
            >
              <GiftIcon />
              <span>Nhập Code</span>
            </button>
```

Add the import for `GiftIcon` to the existing icons import line:

```tsx
import { CauldronIcon, CloseIcon, GiftIcon, LogoutIcon, MenuIcon, ShieldIcon } from "@/components/icons";
```

- [ ] **Step 4: Wire in page.tsx**

In `frontend/src/app/page.tsx`:

Add import:
```tsx
import { RedeemModal } from "@/components/redeem-modal";
```

Add state near the other modal-open states:
```tsx
  const [redeemOpen, setRedeemOpen] = useState(false);
```

Add the success handler (fires particle burst + toast, then refetches cultivation state):
```tsx
  const handleRedeemSuccess = useCallback(
    (result: import("@/lib/types").RedeemResult) => {
      particleRef.current?.spawnBurst?.();
      addToast({
        title: "Đổi code thành công!",
        message: result.rewards.map((r) => `${r.name} ×${r.quantity}`).join(", "),
        type: "success",
      });
      refetch();
    },
    [addToast, refetch],
  );
```

Pass the new prop to `HeaderMenu`:
```tsx
  <HeaderMenu onOpenPills={...} onLogout={...} onOpenRedeem={() => setRedeemOpen(true)} />
```

Add the modal below the pill modal in the JSX:
```tsx
  <RedeemModal open={redeemOpen} onClose={() => setRedeemOpen(false)} onSuccess={handleRedeemSuccess} />
```

- [ ] **Step 5: Typecheck + lint**

Run: `cd frontend && pnpm tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `cd frontend && pnpm test`
Expected: PASS (count unchanged from Task 8 — no new pure-logic tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/icons.tsx frontend/src/components/redeem-modal.tsx frontend/src/components/header-menu.tsx frontend/src/app/page.tsx
git commit -m "feat(redeem): add player redeem modal and header-menu entry"
```

### Task 10: Admin /admin/codes page

**Files:**
- Create: `frontend/src/app/admin/codes/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx` — nav link

**Interfaces:**
- Consumes: `fetchAdminCodes`, `createAdminCode`, `updateAdminCode` (Task 8), `fetchAdminPills` (existing), `validateRedeemDraft`, `findRedeemError` (Task 8), `AdminRedeemCodeDTO` (Task 8), `AdminPillDTO` (existing), `.admin-*` CSS tokens (existing globals.css).
- Produces: `/admin/codes` page — master/detail like `/admin/pills`. Left list: code string, active dot, `redeemedCount/maxRedemptions`, expiry. Right detail: per-code draft/Lưu/Hoàn tác with pill-dropdown reward rows.

No new tests — presentational page. Gate is lint + tsc + build.

- [ ] **Step 1: Add nav link in admin layout**

In `frontend/src/app/admin/layout.tsx`, add after the pills nav link (find the pattern for the existing pill nav item and duplicate it):

```tsx
        <Link
          href="/admin/codes"
          className={`admin-nav-item${pathname === "/admin/codes" ? " active" : ""}`}
        >
          <GiftIcon />
          <span>Redeem Code</span>
        </Link>
```

Add `GiftIcon` to the import from `@/components/icons`.

- [ ] **Step 2: Write the admin codes page**

```tsx
// frontend/src/app/admin/codes/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAdminCode,
  fetchAdminCodes,
  fetchAdminPills,
  updateAdminCode,
} from "@/lib/api";
import type { AdminPillDTO, AdminRedeemCodeDTO } from "@/lib/types";
import {
  findRedeemError,
  validateRedeemDraft,
} from "@/lib/redeem-validation";

type Draft = Omit<AdminRedeemCodeDTO, "redeemedCount">;

function emptyDraft(): Draft {
  return { id: "", code: "", active: true, maxRedemptions: 1, expiresAt: null, rewards: [] };
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<AdminRedeemCodeDTO[]>([]);
  const [pills, setPills] = useState<AdminPillDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [serverDraft, setServerDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ codes: c }, { pills: p }] = await Promise.all([fetchAdminCodes(), fetchAdminPills()]);
      setCodes(c);
      setPills(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Warn on unsaved edits before browser unload.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function selectCode(code: AdminRedeemCodeDTO) {
    const d: Draft = { id: code.id, code: code.code, active: code.active, maxRedemptions: code.maxRedemptions, expiresAt: code.expiresAt, rewards: code.rewards };
    setSelectedId(code.id);
    setIsNew(false);
    setDraft(d);
    setServerDraft(d);
    setDirty(false);
    setSaveError(null);
  }

  function startNew() {
    const d = emptyDraft();
    setSelectedId("__new__");
    setIsNew(true);
    setDraft(d);
    setServerDraft(d);
    setDirty(false);
    setSaveError(null);
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => { const next = { ...prev, ...patch }; setDirty(true); return next; });
  }

  function handleUndo() { setDraft(serverDraft); setDirty(false); setSaveError(null); }

  async function handleSave() {
    const errors = validateRedeemDraft(draft, { isNew });
    if (errors.length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew) {
        const saved = await createAdminCode(draft);
        setCodes((prev) => [saved, ...prev]);
        selectCode(saved);
      } else {
        const { id: _id, code: _code, ...body } = draft;
        const saved = await updateAdminCode(draft.id, body);
        setCodes((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
        selectCode(saved);
      }
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  const errors = validateRedeemDraft(draft, { isNew });
  const hasErrors = errors.length > 0;
  const selected = selectedId === "__new__" ? null : codes.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <h1 className="admin-page-title">Redeem Code</h1>
        <button type="button" className="admin-btn-primary" onClick={startNew} disabled={saving}>
          + Tạo mới
        </button>
      </div>

      {loading ? (
        <div className="admin-skeleton" />
      ) : (
        <div className="admin-pill-layout">
          {/* Left: code list */}
          <div className="admin-pill-list">
            {codes.length === 0 && <p className="admin-empty">Chưa có mã nào.</p>}
            {codes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`admin-pill-row${selectedId === c.id ? " active" : ""}`}
                aria-current={selectedId === c.id ? "true" : undefined}
                onClick={() => selectCode(c)}
              >
                <span className="admin-pill-glyph" style={{ fontFamily: "monospace" }}>{c.code}</span>
                <span className="admin-pill-name">{c.redeemedCount}/{c.maxRedemptions} lượt</span>
                {!c.active && <span className="pill-badge pill-badge-off">Tắt</span>}
                {c.expiresAt && <span className="pill-badge pill-badge-muted">{new Date(c.expiresAt).toLocaleDateString("vi-VN")}</span>}
              </button>
            ))}
          </div>

          {/* Right: detail form */}
          <div className="admin-pill-detail">
            {selectedId == null ? (
              <p className="admin-empty">Chọn mã để chỉnh sửa hoặc tạo mới.</p>
            ) : (
              <div className="admin-panel">
                <div className="admin-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 className="admin-panel-title">{isNew ? "Tạo mã mới" : selected?.code ?? ""}</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="admin-btn-secondary" onClick={handleUndo} disabled={!dirty || saving}>Hoàn tác</button>
                    <button type="button" className="admin-btn-primary" onClick={handleSave} disabled={hasErrors || saving || !dirty}>{saving ? "Đang lưu..." : "Lưu"}</button>
                  </div>
                </div>

                {saveError && <p className="text-danger" style={{ marginBottom: 12 }}>{saveError}</p>}

                <div className="admin-substage-grid" style={{ gap: 12, marginBottom: 16 }}>
                  {isNew && (
                    <label className="admin-field-label">
                      ID (slug)
                      <input className="admin-input" value={draft.id} onChange={(e) => updateDraft({ id: e.target.value })} disabled={saving} placeholder="vi-du-code" />
                      {findRedeemError(errors, "id") && <span className="text-danger">{findRedeemError(errors, "id")!.message}</span>}
                    </label>
                  )}
                  {isNew && (
                    <label className="admin-field-label">
                      Mã code
                      <input className="admin-input" value={draft.code} onChange={(e) => updateDraft({ code: e.target.value.toUpperCase() })} disabled={saving} placeholder="TANTHU2026" />
                      {findRedeemError(errors, "code") && <span className="text-danger">{findRedeemError(errors, "code")!.message}</span>}
                    </label>
                  )}
                  <label className="admin-field-label">
                    Tổng lượt đổi tối đa
                    <input className="admin-input" type="number" min={1} value={Number.isNaN(draft.maxRedemptions) ? "" : draft.maxRedemptions} onChange={(e) => updateDraft({ maxRedemptions: e.target.value === "" ? NaN : parseInt(e.target.value, 10) })} disabled={saving} />
                    {findRedeemError(errors, "maxRedemptions") && <span className="text-danger">{findRedeemError(errors, "maxRedemptions")!.message}</span>}
                  </label>
                  <label className="admin-field-label">
                    Hết hạn (để trống = không hết hạn)
                    <input className="admin-input" type="datetime-local" value={draft.expiresAt ? draft.expiresAt.slice(0, 16) : ""} onChange={(e) => updateDraft({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} disabled={saving} />
                  </label>
                  <label className="admin-field-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={draft.active} onChange={(e) => updateDraft({ active: e.target.checked })} disabled={saving} />
                    Kích hoạt
                  </label>
                </div>

                {/* Rewards rows */}
                <div style={{ marginBottom: 12 }}>
                  <h3 className="admin-section-title">Phần thưởng</h3>
                  {findRedeemError(errors, "rewards") && <p className="text-danger">{findRedeemError(errors, "rewards")!.message}</p>}
                  {draft.rewards.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <select
                        className="admin-input"
                        value={r.pillId}
                        aria-label={`Đan dược hàng ${i + 1}`}
                        onChange={(e) => {
                          const rewards = draft.rewards.map((x, j) => j === i ? { ...x, pillId: e.target.value } : x);
                          updateDraft({ rewards });
                        }}
                        disabled={saving}
                      >
                        <option value="">-- Chọn đan dược --</option>
                        {pills.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        className="admin-input"
                        type="number"
                        min={1}
                        style={{ width: 80 }}
                        aria-label={`Số lượng hàng ${i + 1}`}
                        value={Number.isNaN(r.quantity) ? "" : r.quantity}
                        onChange={(e) => {
                          const rewards = draft.rewards.map((x, j) => j === i ? { ...x, quantity: e.target.value === "" ? NaN : parseInt(e.target.value, 10) } : x);
                          updateDraft({ rewards });
                        }}
                        disabled={saving}
                      />
                      <button type="button" className="admin-btn-secondary" aria-label={`Xóa hàng ${i + 1}`} onClick={() => updateDraft({ rewards: draft.rewards.filter((_, j) => j !== i) })} disabled={saving}>Xóa</button>
                    </div>
                  ))}
                  <button type="button" className="admin-btn-secondary" onClick={() => updateDraft({ rewards: [...draft.rewards, { pillId: "", quantity: 1 }] })} disabled={saving}>+ Thêm đan dược</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `cd frontend && pnpm tsc --noEmit && pnpm lint && pnpm build`
Expected: no errors; `/admin/codes` present in build output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/codes frontend/src/app/admin/layout.tsx
git commit -m "feat(redeem): add admin /admin/codes page"
```

### Task 11: Full gate + CLAUDE.md update + manual verification

**Files:**
- Modify: `CLAUDE.md`

**Goal:** Final gate pass (backend + frontend), manual cookie-jar verification against Docker Postgres, then document the feature.

- [ ] **Step 1: Final backend gate**

Run: `cd backend && npm test`
Expected: all tests pass (should be 230 + new tests from Tasks 1–7).

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Final frontend gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: no errors; all tests pass; `/admin/codes` in build output.

- [ ] **Step 3: Manual verification (cookie jar vs. Docker Postgres)**

Start the backend: `cd backend && docker compose up -d --build`

Verify the following flow with a cookie jar (e.g. `curl --cookie-jar /tmp/j --cookie /tmp/j`):

1. Register + promote to admin → login as admin.
2. `GET /admin/codes` → empty list (no codes yet) → 200.
3. `POST /admin/codes` with `{ id: "tan-thu-2026", code: "TANTHU2026", active: true, maxRedemptions: 2, expiresAt: null, rewards: [{ pillId: "hoi-khi-dan", quantity: 3 }] }` → 201; body has `code: "TANTHU2026"`, `redeemedCount: 0`.
4. Register player A + login. `POST /redeem` `{ code: "tanthu2026" }` (lowercase) → 200; `rewards[0].quantity === 3`; `GET /pills/inventory` shows `hoi-khi-dan ×3`.
5. Player A redeems again → 409 `REDEEM_CODE_ALREADY_USED`.
6. Register player B + login. `POST /redeem` `{ code: "TANTHU2026" }` → 200 (`redeemedCount` 1→2).
7. Register player C + login. `POST /redeem` → 409 `REDEEM_CODE_EXHAUSTED`.
8. Admin `PUT /admin/codes/tan-thu-2026` `{ active: false, maxRedemptions: 2, expiresAt: null, rewards: [...] }` → 200.
9. Register player D + login. `POST /redeem` → 400 `REDEEM_CODE_INACTIVE`.
10. `POST /admin/codes` with same id or code → 409 `REDEEM_CODE_TAKEN`.
11. Non-admin `GET /admin/codes` → 403.
12. `POST /admin/codes` with `maxRedemptions: 0` → 400 `INVALID_REDEEM_CODE`.
13. Remove verification users + test code from DB (or `docker compose down -v` + `docker compose up -d --build` + `npm run db:seed`).

- [ ] **Step 4: Update CLAUDE.md**

Add a new section after "## Admin Pro-Dashboard Rebuild" (before "## Backend Security Hardening") in `CLAUDE.md`:

````markdown
## Redeem Code

Admin-created shareable codes that grant a bundle of đan dược (pills) to players. A code is redeemable once per user, capped by a total count, and optionally expires. Spec `docs/superpowers/specs/2026-07-21-redeem-code-design.md`, plan `docs/superpowers/plans/2026-07-21-redeem-code.md`.

- **Schema (migration `redeem_code`):** `RedeemCode` (id, code unique, active, maxRedemptions, redeemedCount, expiresAt), `RedeemCodeReward` (`@@unique([codeId, pillId])`), `Redemption` (`@@unique([codeId, userId])`, `onDelete: Cascade` on both user and code). `Pill` gained `redeemRewards` back-relation; `User` gained `redemptions` back-relation.
- **Domain:** `domain/redeem/redeemCode.ts` (pure types: `RewardEntry`, `RedeemCodeRecord`, `RedeemResultDto`), `redeemCode.validate.ts` (`normalizeCode` trim+uppercase, `validateRedeemCodeDefinition`). Port: `RedeemCodeRepository` (`findByCode`, `listAll`, `create`, `update`, `tryReserveRedemption`, `grantRewards`).
- **Atomicity:** `tryReserveRedemption` inserts the `Redemption` row first (unique-constraint = per-user-once guard), then `updateMany({ redeemedCount: { lt: max } })` — count 0 means cap hit, compensates by deleting the reservation and returning `'exhausted'`. No cross-repo transactions in the application layer.
- **Application:** `RedeemCodeUseCase` (player), `ListRedeemCodesUseCase`, `CreateRedeemCodeUseCase`, `UpdateRedeemCodeUseCase` (admin). Guard order: not-found → inactive → expired → reserve → grant. Disabled-pill rewards are granted anyway (code's promise takes precedence over the pill's visibility flag).
- **Presentation:** `POST /redeem` (player, `requireAuth`); `GET/POST/PUT /admin/codes` (admin). `errorHandler` maps 7 new codes. Wired in `app.ts`.
- **Frontend:** `RedeemModal` (GSAP, opens from HeaderMenu "Nhập Code" — `GiftIcon`). On success: `ParticleCanvas.spawnBurst` + success toast + cultivation `refetch()`. Admin `/admin/codes` master/detail (like `/admin/pills`): create, edit active/expiry/maxRedemptions/rewards, per-pill dropdown. `lib/redeem-validation.ts` mirrors backend rules for pre-flight errors.
- **Verification:** backend N tests; frontend lint/tsc/tests/build green. Manual cookie-jar pass: create → player A redeems (normalized lowercase) → 409 on second try → player B redeems → player C exhausted → admin disables → player D inactive → non-admin 403.
````

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(redeem): complete redeem code feature — update CLAUDE.md"
```

<!-- END OF PLAN -->











