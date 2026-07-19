# Admin Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin dashboard inside the existing Next.js app: `/admin` shell with role guard, a stats overview page (new `GET /admin/stats`), a realm-config editor UI over the existing `GET/PUT /admin/realms`, plus a new `GET /auth/me` for role detection.

**Architecture:** Backend adds two thin read endpoints following the existing Clean Architecture layering (use case + port + Prisma adapter + route). Frontend adds an `/admin` route group with a client-side guard (real security stays in the backend's `requireAuth + requireAdmin`), a draft-state realm editor with pure validation logic in `lib/`, and a `me` state in the existing `auth-context`.

**Tech Stack:** Express 4 + TypeScript + Prisma 5.22 (backend, Vitest + supertest); Next.js 16 App Router + React 19 (frontend, Vitest node-env for pure logic, Biome).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-admin-dashboard-phase1-design.md`. Branch: `feat/admin-dashboard` (branched from `feat/realm-config-db`).
- Clean Architecture: `domain/` has zero framework imports; `application/` depends only on domain ports; dependency direction inward only.
- Comment non-trivial logic with the *why* (project Mandatory Rule).
- Before using any library API not already used identically in the codebase, verify its shape via the `ctx7` CLI (project Mandatory Rule). Prisma `groupBy` in Task 4 is the one new API surface.
- Backend tests: `cd backend && npx vitest run <file>` for one file, `npm test` for the suite (`fileParallelism: false` — shared Postgres; Docker `db` service must be up: `cd backend && docker compose up -d db`).
- Frontend: `cd frontend && pnpm vitest run <file>`, gate = `pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`.
- Commits: conventional messages, **no Co-Authored-By trailer** (user preference).
- UI copy is Vietnamese (matches existing app): "Quản trị", "Thống kê", "Cảnh giới", "Lưu tất cả", "Hoàn tác", "Làm mới", "Thử lại", "← Về game".
- **DTO note (deviation from spec prose):** `GET/PUT /admin/realms` sub-stages use field `name` (the backend's `SubStageConfig.name`), NOT `subStageName`. The frontend types in Task 5 follow the real API.
- Update `CLAUDE.md` after each task if that task introduced new commands/architecture; Task 11 writes the consolidated section.

---

### Task 1: Backend — `GetCurrentUserUseCase` + `USER_NOT_FOUND` → 401

**Files:**
- Create: `backend/src/application/GetCurrentUserUseCase.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts` (add one status-map line)
- Test: `backend/tests/unit/GetCurrentUserUseCase.test.ts`, `backend/tests/unit/errorHandler.test.ts`

**Interfaces:**
- Consumes: `UserRepository.findById(id): Promise<UserRecord | null>` (exists), `DomainError(code, message)` (exists), `InMemoryUserRepository` fake (exists, has `create` + `setRole`).
- Produces: `class GetCurrentUserUseCase { constructor(users: UserRepository); execute(input: { userId: string; role: string }): Promise<CurrentUserOutput> }` where `CurrentUserOutput = { id: string; username: string; role: string }`. Task 2's route calls this.

- [ ] **Step 1: Write the failing unit tests**

`backend/tests/unit/GetCurrentUserUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GetCurrentUserUseCase } from '../../src/application/GetCurrentUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { DomainError } from '../../src/domain/errors';

describe('GetCurrentUserUseCase', () => {
  it('returns id, username, and the role carried by the token', async () => {
    const users = new InMemoryUserRepository();
    const user = await users.create({ username: 'alice', passwordHash: 'x' });
    const useCase = new GetCurrentUserUseCase(users);

    const result = await useCase.execute({ userId: user.id, role: 'admin' });

    expect(result).toEqual({ id: user.id, username: 'alice', role: 'admin' });
  });

  it('throws USER_NOT_FOUND when the user no longer exists', async () => {
    const useCase = new GetCurrentUserUseCase(new InMemoryUserRepository());

    await expect(useCase.execute({ userId: 'ghost', role: 'user' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    await expect(useCase.execute({ userId: 'ghost', role: 'user' })).rejects.toBeInstanceOf(DomainError);
  });
});
```

Append to `backend/tests/unit/errorHandler.test.ts` — add a route to `buildTestApp()`:

```typescript
  app.get('/boom-user-not-found', () => {
    throw new DomainError('USER_NOT_FOUND', 'User no longer exists');
  });
```

and a test inside the existing `describe`:

```typescript
  it('maps USER_NOT_FOUND to 401', async () => {
    const res = await request(buildTestApp()).get('/boom-user-not-found');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' } });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/unit/GetCurrentUserUseCase.test.ts tests/unit/errorHandler.test.ts`
Expected: GetCurrentUserUseCase tests FAIL (module not found); errorHandler new case FAILS (500, unknown code).

- [ ] **Step 3: Implement**

`backend/src/application/GetCurrentUserUseCase.ts`:

```typescript
import { UserRepository } from '../domain/ports/UserRepository';
import { DomainError } from '../domain/errors';

export interface CurrentUserOutput {
  id: string;
  username: string;
  role: string;
}

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  // The role is taken from the verified access token, NOT re-read from the DB:
  // the UI should mirror what requireAdmin will actually enforce for this
  // session. A freshly promoted user only becomes "admin" here once their
  // token carries the claim (next refresh/login) — otherwise the UI would show
  // admin links whose API calls still 403.
  async execute(input: { userId: string; role: string }): Promise<CurrentUserOutput> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      // Token outlived the account (user deleted): treat as unauthenticated.
      throw new DomainError('USER_NOT_FOUND', 'User no longer exists');
    }
    return { id: user.id, username: user.username, role: input.role };
  }
}
```

In `backend/src/presentation/middleware/errorHandler.ts`, add to `STATUS_BY_CODE` (after `INVALID_REALM_CONFIG: 400,`):

```typescript
  USER_NOT_FOUND: 401,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/GetCurrentUserUseCase.test.ts tests/unit/errorHandler.test.ts`
Expected: PASS (2 + 7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/application/GetCurrentUserUseCase.ts backend/src/presentation/middleware/errorHandler.ts backend/tests/unit/GetCurrentUserUseCase.test.ts backend/tests/unit/errorHandler.test.ts
git commit -m "feat(backend): add GetCurrentUserUseCase with USER_NOT_FOUND mapped to 401"
```

---

### Task 2: Backend — `GET /auth/me` route + wiring

**Files:**
- Modify: `backend/src/presentation/routes/auth.routes.ts` (new deps + route), `backend/src/app.ts` (construct + pass)
- Test: `backend/tests/integration/auth.me.test.ts`

**Interfaces:**
- Consumes: `GetCurrentUserUseCase` (Task 1), `createRequireAuth(tokenService)` → `RequestHandler` that sets `req.userId`/`req.role` (exists), `AuthedRequest` (exists).
- Produces: `GET /auth/me` → 200 `{ id, username, role }`; 401 without a valid token. `AuthRouterDeps` gains `getCurrentUserUseCase: GetCurrentUserUseCase; requireAuth: RequestHandler`. Frontend Task 5 consumes this endpoint.

- [ ] **Step 1: Write the failing integration test**

`backend/tests/integration/auth.me.test.ts` (integration tests hit real Postgres; `cd backend && docker compose up -d db` first):

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /auth/me', () => {
  it('returns id, username, and role for a logged-in user (cookie auth)', async () => {
    await request(app).post('/auth/register').send({ username: 'mei', password: 'password123' });
    const login = await request(app).post('/auth/login').send({ username: 'mei', password: 'password123' });
    const cookies = login.headers['set-cookie'] as unknown as string[];

    const res = await request(app).get('/auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), username: 'mei', role: 'user' });
  });

  it('carries role admin once the token does', async () => {
    await request(app).post('/auth/register').send({ username: 'root', password: 'password123' });
    await prisma.user.update({ where: { username: 'root' }, data: { role: 'admin' } });
    // Re-login so the access token carries role:admin.
    const login = await request(app).post('/auth/login').send({ username: 'root', password: 'password123' });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/auth.me.test.ts`
Expected: FAIL — 404s (route doesn't exist).

- [ ] **Step 3: Implement route + wiring**

`backend/src/presentation/routes/auth.routes.ts` — extend imports and deps:

```typescript
import { Router, RequestHandler } from 'express';
import { GetCurrentUserUseCase } from '../../application/GetCurrentUserUseCase';
import { AuthedRequest } from '../middleware/auth';
```

```typescript
export interface AuthRouterDeps {
  registerUserUseCase: RegisterUserUseCase;
  loginUserUseCase: LoginUserUseCase;
  refreshAccessTokenUseCase: RefreshAccessTokenUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  requireAuth: RequestHandler;
}
```

Add the route (before `return router;`):

```typescript
  // Who am I? Used by the frontend to gate /admin and show admin-only menu
  // items. requireAuth is applied per-route: the other /auth endpoints must
  // stay reachable without a session.
  router.get('/me', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const result = await deps.getCurrentUserUseCase.execute({
        userId: req.userId as string,
        role: req.role ?? 'user',
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
```

`backend/src/app.ts` — construct and pass:

```typescript
import { GetCurrentUserUseCase } from './application/GetCurrentUserUseCase';
```

after `updateRealmConfigUseCase`:

```typescript
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
```

Note: `const requireAuth = createRequireAuth(tokenService);` already exists **below** the use-case block — the auth router mount must receive it, so update the mount:

```typescript
  app.use(
    '/auth',
    createAuthRouter({ registerUserUseCase, loginUserUseCase, refreshAccessTokenUseCase, getCurrentUserUseCase, requireAuth }),
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/integration/auth.me.test.ts && npx tsc --noEmit`
Expected: 3 PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/presentation/routes/auth.routes.ts backend/src/app.ts backend/tests/integration/auth.me.test.ts
git commit -m "feat(backend): add GET /auth/me returning id, username, and token role"
```

---

### Task 3: Backend — `StatsRepository` port + fake + `GetAdminStatsUseCase`

**Files:**
- Create: `backend/src/domain/ports/StatsRepository.ts`, `backend/src/application/GetAdminStatsUseCase.ts`, `backend/tests/fakes/InMemoryStatsRepository.ts`
- Test: `backend/tests/unit/GetAdminStatsUseCase.test.ts`

**Interfaces:**
- Consumes: `RealmConfigSource.get(): RealmConfigSet` with `maxRealmMajor: number` and `realmName(major): string` (exists), `StaticRealmConfigSource` fake (exists, defaults to the 12-realm seed config).
- Produces:
  ```typescript
  // domain/ports/StatsRepository.ts
  export interface RealmCount { realmMajor: number; count: number }
  export interface StatsRepository {
    countUsers(): Promise<number>;
    countAdmins(): Promise<number>;
    countCharactersByRealm(): Promise<RealmCount[]>;
    countPunished(now: Date): Promise<number>;
  }
  // application/GetAdminStatsUseCase.ts
  export interface RealmDistributionEntry { realmMajor: number; realmName: string; count: number }
  export interface AdminStatsOutput { totalUsers: number; totalAdmins: number; realmDistribution: RealmDistributionEntry[]; punishedCount: number }
  export class GetAdminStatsUseCase {
    constructor(stats: StatsRepository, realmConfig: RealmConfigSource);
    execute(now?: Date): Promise<AdminStatsOutput>;
  }
  ```
  Task 4's Prisma adapter implements `StatsRepository`; Task 4's route calls `execute()`.

- [ ] **Step 1: Write the failing unit tests**

`backend/tests/unit/GetAdminStatsUseCase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GetAdminStatsUseCase } from '../../src/application/GetAdminStatsUseCase';
import { InMemoryStatsRepository } from '../fakes/InMemoryStatsRepository';
import { StaticRealmConfigSource } from '../fakes/StaticRealmConfigSource';

describe('GetAdminStatsUseCase', () => {
  it('aggregates counts and maps realmMajor to the configured realm name, sorted ascending', async () => {
    const stats = new InMemoryStatsRepository();
    stats.users = 10;
    stats.admins = 2;
    stats.punished = 3;
    // Deliberately out of order — the use case must sort by realmMajor.
    stats.byRealm = [
      { realmMajor: 1, count: 4 },
      { realmMajor: 0, count: 6 },
    ];
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());

    const result = await useCase.execute();

    expect(result.totalUsers).toBe(10);
    expect(result.totalAdmins).toBe(2);
    expect(result.punishedCount).toBe(3);
    expect(result.realmDistribution).toEqual([
      { realmMajor: 0, realmName: 'Phàm Nhân', count: 6 },
      { realmMajor: 1, realmName: 'Luyện Khí', count: 4 },
    ]);
  });

  it('labels a realm missing from config as "Realm #N" instead of throwing', async () => {
    const stats = new InMemoryStatsRepository();
    // Seed config has 12 realms (majors 0..11) — 99 is out of range, as after
    // an admin deletes realms while characters still sit in them.
    stats.byRealm = [{ realmMajor: 99, count: 1 }];
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());

    const result = await useCase.execute();

    expect(result.realmDistribution).toEqual([{ realmMajor: 99, realmName: 'Realm #99', count: 1 }]);
  });

  it('passes the provided now to countPunished', async () => {
    const stats = new InMemoryStatsRepository();
    const useCase = new GetAdminStatsUseCase(stats, new StaticRealmConfigSource());
    const now = new Date('2026-07-19T00:00:00Z');

    await useCase.execute(now);

    expect(stats.lastPunishedNow).toEqual(now);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/unit/GetAdminStatsUseCase.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement port, fake, and use case**

`backend/src/domain/ports/StatsRepository.ts`:

```typescript
export interface RealmCount {
  realmMajor: number;
  count: number;
}

export interface StatsRepository {
  countUsers(): Promise<number>;
  countAdmins(): Promise<number>;
  countCharactersByRealm(): Promise<RealmCount[]>;
  countPunished(now: Date): Promise<number>;
}
```

`backend/tests/fakes/InMemoryStatsRepository.ts`:

```typescript
import { StatsRepository, RealmCount } from '../../src/domain/ports/StatsRepository';

export class InMemoryStatsRepository implements StatsRepository {
  users = 0;
  admins = 0;
  byRealm: RealmCount[] = [];
  punished = 0;
  /** Captured for assertions: the `now` the use case passed in. */
  lastPunishedNow: Date | null = null;

  async countUsers(): Promise<number> {
    return this.users;
  }

  async countAdmins(): Promise<number> {
    return this.admins;
  }

  async countCharactersByRealm(): Promise<RealmCount[]> {
    return this.byRealm;
  }

  async countPunished(now: Date): Promise<number> {
    this.lastPunishedNow = now;
    return this.punished;
  }
}
```

`backend/src/application/GetAdminStatsUseCase.ts`:

```typescript
import { StatsRepository } from '../domain/ports/StatsRepository';
import { RealmConfigSource } from '../domain/ports/RealmConfigSource';

export interface RealmDistributionEntry {
  realmMajor: number;
  realmName: string;
  count: number;
}

export interface AdminStatsOutput {
  totalUsers: number;
  totalAdmins: number;
  realmDistribution: RealmDistributionEntry[];
  punishedCount: number;
}

export class GetAdminStatsUseCase {
  constructor(
    private readonly stats: StatsRepository,
    private readonly realmConfig: RealmConfigSource,
  ) {}

  async execute(now: Date = new Date()): Promise<AdminStatsOutput> {
    const config = this.realmConfig.get();
    const [totalUsers, totalAdmins, byRealm, punishedCount] = await Promise.all([
      this.stats.countUsers(),
      this.stats.countAdmins(),
      this.stats.countCharactersByRealm(),
      this.stats.countPunished(now),
    ]);

    const realmDistribution = [...byRealm]
      .sort((a, b) => a.realmMajor - b.realmMajor)
      .map(({ realmMajor, count }) => ({
        realmMajor,
        // Characters can sit in a realm the admin has since deleted from the
        // config (free structural editing) — label it by index rather than
        // letting realmName() read past the config array.
        realmName:
          realmMajor >= 0 && realmMajor <= config.maxRealmMajor
            ? config.realmName(realmMajor)
            : `Realm #${realmMajor}`,
        count,
      }));

    return { totalUsers, totalAdmins, realmDistribution, punishedCount };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/GetAdminStatsUseCase.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/domain/ports/StatsRepository.ts backend/src/application/GetAdminStatsUseCase.ts backend/tests/fakes/InMemoryStatsRepository.ts backend/tests/unit/GetAdminStatsUseCase.test.ts
git commit -m "feat(backend): add StatsRepository port and GetAdminStatsUseCase"
```

---

### Task 4: Backend — `PrismaStatsRepository` + `GET /admin/stats` + wiring

**Files:**
- Create: `backend/src/infrastructure/repositories/PrismaStatsRepository.ts`
- Modify: `backend/src/presentation/routes/admin.routes.ts`, `backend/src/app.ts`
- Test: `backend/tests/integration/admin.stats.test.ts`

**Interfaces:**
- Consumes: `StatsRepository`/`RealmCount` (Task 3), `GetAdminStatsUseCase` (Task 3), `createAdminRouter` deps pattern (exists — router already applies `requireAuth + requireAdmin` to all routes).
- Produces: `GET /admin/stats` → 200 `{ totalUsers, totalAdmins, realmDistribution: [{ realmMajor, realmName, count }], punishedCount }`; 403 non-admin. `AdminRouterDeps` gains `getAdminStatsUseCase: GetAdminStatsUseCase`. Frontend Task 5 consumes this endpoint.

- [ ] **Step 1: Verify Prisma `groupBy` API shape via ctx7 (Mandatory Rule)**

Run: `npx ctx7@latest docs /prisma/docs "groupBy count rows per group with _count and count with where filter on nullable DateTime greater than now, Prisma Client 5"`
Confirm against `backend/package.json`'s pinned Prisma 5.22: `groupBy({ by: ['field'], _count: { _all: true } })` returns `[{ field, _count: { _all: number } }]`, and `count({ where: { punishedUntil: { gt: now } } })` ignores nulls. If the fetched docs differ from the code below, follow the docs.

- [ ] **Step 2: Write the failing integration test**

`backend/tests/integration/admin.stats.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /admin/stats', () => {
  it('rejects a non-admin with 403', async () => {
    const token = await registerAndLogin('pleb');
    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns counts matching the data this test created', async () => {
    const adminToken = await registerAdminAndLogin('root');
    await registerAndLogin('a');
    await registerAndLogin('b');
    // Move b's character to realm 1 and punish a's character.
    await prisma.character.updateMany({
      where: { user: { username: 'b' } },
      data: { realmMajor: 1 },
    });
    await prisma.character.updateMany({
      where: { user: { username: 'a' } },
      data: { punishedUntil: new Date(Date.now() + 60_000) },
    });

    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.totalAdmins).toBe(1);
    expect(res.body.punishedCount).toBe(1);
    // root + a in realm 0, b in realm 1; names come from the seeded config.
    expect(res.body.realmDistribution).toEqual([
      { realmMajor: 0, realmName: 'Phàm Nhân', count: 2 },
      { realmMajor: 1, realmName: 'Luyện Khí', count: 1 },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/admin.stats.test.ts`
Expected: FAIL — 404 on `/admin/stats`.

- [ ] **Step 4: Implement adapter, route, wiring**

`backend/src/infrastructure/repositories/PrismaStatsRepository.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { StatsRepository, RealmCount } from '../../domain/ports/StatsRepository';

export class PrismaStatsRepository implements StatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  countUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  countAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'admin' } });
  }

  async countCharactersByRealm(): Promise<RealmCount[]> {
    const groups = await this.prisma.character.groupBy({
      by: ['realmMajor'],
      _count: { _all: true },
    });
    return groups.map((g) => ({ realmMajor: g.realmMajor, count: g._count._all }));
  }

  countPunished(now: Date): Promise<number> {
    // gt on a nullable DateTime: NULL (never punished) rows never match.
    return this.prisma.character.count({ where: { punishedUntil: { gt: now } } });
  }
}
```

`backend/src/presentation/routes/admin.routes.ts` — extend deps and add the route:

```typescript
import { GetAdminStatsUseCase } from '../../application/GetAdminStatsUseCase';
```

```typescript
export interface AdminRouterDeps {
  updateRealmConfigUseCase: UpdateRealmConfigUseCase;
  getAdminStatsUseCase: GetAdminStatsUseCase;
  realmConfigProvider: RealmConfigProvider;
  requireAuth: RequestHandler;
}
```

Add before `return router;` (the router-level `requireAuth + requireAdmin` already covers it):

```typescript
  router.get('/stats', async (_req, res, next) => {
    try {
      res.status(200).json(await deps.getAdminStatsUseCase.execute());
    } catch (err) {
      next(err);
    }
  });
```

`backend/src/app.ts`:

```typescript
import { PrismaStatsRepository } from './infrastructure/repositories/PrismaStatsRepository';
import { GetAdminStatsUseCase } from './application/GetAdminStatsUseCase';
```

after `realmConfigProvider`:

```typescript
  const statsRepository = new PrismaStatsRepository(client);
```

after `getCurrentUserUseCase`:

```typescript
  const getAdminStatsUseCase = new GetAdminStatsUseCase(statsRepository, realmConfigProvider);
```

and extend the admin mount:

```typescript
  app.use(
    '/admin',
    createAdminRouter({ updateRealmConfigUseCase, getAdminStatsUseCase, realmConfigProvider, requireAuth }),
  );
```

- [ ] **Step 5: Run tests to verify they pass, then the full backend suite**

Run: `cd backend && npx vitest run tests/integration/admin.stats.test.ts && npm test`
Expected: 2 PASS, then full suite green (171 existing + 11 new = 182) and typecheck via `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/infrastructure/repositories/PrismaStatsRepository.ts backend/src/presentation/routes/admin.routes.ts backend/src/app.ts backend/tests/integration/admin.stats.test.ts
git commit -m "feat(backend): add GET /admin/stats with Prisma-backed aggregates"
```

---

### Task 5: Frontend — types + API functions + stub tests

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts` (append)

**Interfaces:**
- Consumes: `apiFetch<T>(path, options)` (exists — cookies + silent refresh-retry).
- Produces (used by Tasks 6–10):
  ```typescript
  // types.ts
  export interface Me { id: string; username: string; role: string }
  export interface RealmDistributionEntry { realmMajor: number; realmName: string; count: number }
  export interface AdminStats { totalUsers: number; totalAdmins: number; realmDistribution: RealmDistributionEntry[]; punishedCount: number }
  export interface AdminSubStage { name: string; linhKhiRequired: number; cultivationRate: number; baseSuccessRate: number; pityIncrement: number; maxSuccessRate: number; punishmentSeconds: number }
  export interface AdminRealm { name: string; subStages: AdminSubStage[] }
  // api.ts
  export function fetchMe(): Promise<Me>
  export function fetchAdminStats(): Promise<AdminStats>
  export function fetchAdminRealms(): Promise<{ realms: AdminRealm[] }>
  export function updateAdminRealms(realms: AdminRealm[]): Promise<{ realms: AdminRealm[] }>
  ```

- [ ] **Step 1: Write the failing stub-fetch tests**

Append to `frontend/src/lib/api.test.ts` (reuse the file's existing `jsonResponse` helper and `afterEach` cleanup; extend the import line to `import { apiFetch, fetchMe, updateAdminRealms } from "./api";`):

```typescript
describe("admin api", () => {
  it("fetchMe GETs /auth/me", async () => {
    const me = { id: "u1", username: "alice", role: "admin" };
    const fetchMock = vi.fn(async () => jsonResponse(200, me));
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchMe();

    expect(data).toEqual(me);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/me");
  });

  it("updateAdminRealms PUTs the realms wrapped in { realms }", async () => {
    const realms = [
      {
        name: "Phàm Nhân",
        subStages: [
          {
            name: "Sơ Kỳ",
            linhKhiRequired: 100,
            cultivationRate: 1,
            baseSuccessRate: 90,
            pityIncrement: 10,
            maxSuccessRate: 95,
            punishmentSeconds: 300,
          },
        ],
      },
    ];
    const fetchMock = vi.fn(async () => jsonResponse(200, { realms }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await updateAdminRealms(realms);

    expect(data).toEqual({ realms });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/realms");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ realms });
  });

  it("admin fetches surface the server error message on failure", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        error: { code: "INVALID_REALM_CONFIG", message: "linhKhiRequired must strictly increase" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateAdminRealms([])).rejects.toThrow(
      "linhKhiRequired must strictly increase",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/lib/api.test.ts`
Expected: FAIL — `fetchMe`/`updateAdminRealms` not exported.

- [ ] **Step 3: Implement types and API functions**

Append to `frontend/src/lib/types.ts`:

```typescript
// GET /auth/me — the logged-in user's identity as the backend sees this session.
export interface Me {
  id: string;
  username: string;
  role: string; // "user" | "admin"
}

// GET /admin/stats
export interface RealmDistributionEntry {
  realmMajor: number;
  realmName: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  realmDistribution: RealmDistributionEntry[];
  punishedCount: number;
}

// GET/PUT /admin/realms — mirrors the backend's SubStageConfig/RealmConfig.
export interface AdminSubStage {
  name: string;
  linhKhiRequired: number;
  cultivationRate: number;
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  punishmentSeconds: number;
}

export interface AdminRealm {
  name: string;
  subStages: AdminSubStage[];
}
```

In `frontend/src/lib/api.ts`, extend the type import and append:

```typescript
import type {
  AdminRealm,
  AdminStats,
  ApiError,
  CultivationState,
  Me,
  PillInventoryItem,
} from "./types";
```

```typescript
// GET /auth/me — who is logged in (id, username, role from the access token).
export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

// GET /admin/stats — aggregate counts for the admin overview page.
export function fetchAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats");
}

// GET /admin/realms — the full live realm config.
export function fetchAdminRealms(): Promise<{ realms: AdminRealm[] }> {
  return apiFetch<{ realms: AdminRealm[] }>("/admin/realms");
}

// PUT /admin/realms — full replace; the backend validates and live-reloads.
export function updateAdminRealms(
  realms: AdminRealm[],
): Promise<{ realms: AdminRealm[] }> {
  return apiFetch<{ realms: AdminRealm[] }>("/admin/realms", {
    method: "PUT",
    body: JSON.stringify({ realms }),
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/lib/api.test.ts && pnpm tsc --noEmit`
Expected: all PASS (existing + 3 new), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(frontend): add admin API client functions and types"
```

---

### Task 6: Frontend — `me` in auth-context + "Quản trị" menu item

**Files:**
- Modify: `frontend/src/lib/auth-context.tsx`, `frontend/src/components/header-menu.tsx`, `frontend/src/components/icons.tsx`

**Interfaces:**
- Consumes: `fetchMe(): Promise<Me>` (Task 5), existing `AuthProvider` (probes a protected endpoint on mount), existing `HeaderMenu` (desktop inline + mobile dropdown), `IconProps`/`base` pattern in `icons.tsx`.
- Produces: `useAuth()` gains `me: Me | null` (null until loaded / when logged out). `HeaderMenu` shows a "Quản trị" item (→ `router.push("/admin")`) only when `me?.role === "admin"`. Task 7's layout consumes `me`/`isAuthenticated`/`isLoading`.

- [ ] **Step 1: Extend auth-context**

In `frontend/src/lib/auth-context.tsx`:
- Add imports: `import { fetchMe } from "./api";` and `import type { Me } from "./types";`
- Extend the context value interface:

```typescript
interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  me: Me | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

- Replace the mount probe and session handlers. The probe switches from `GET /cultivation/state` to `GET /auth/me` — it serves the same "is the cookie valid?" purpose but also yields the role in one round-trip:

```typescript
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  // Probe /auth/me on mount: a valid httpOnly cookie yields both the auth
  // check and the role (for admin-only UI) in a single request.
  useEffect(() => {
    fetchMe()
      .then((current) => {
        setMe(current);
        setIsAuthenticated(true);
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    // Login's JSON body has no role — fetch the identity the new cookie grants.
    setMe(await fetchMe());
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setMe(await fetchMe());
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setMe(null);
    setIsAuthenticated(false);
  }, []);
```

- Provide `me` in the Provider value: `value={{ isAuthenticated, isLoading, me, login, register, logout }}`.

- [ ] **Step 2: Add `ShieldIcon` to icons.tsx**

Append to `frontend/src/components/icons.tsx` (same `base(props)` pattern as the file's other icons):

```typescript
// Admin shield used on the Quản trị menu item.
export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Quản trị</title>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="M9.5 12l2 2 3.5-4" />
    </svg>
  );
}
```

- [ ] **Step 3: Add the admin item to HeaderMenu**

In `frontend/src/components/header-menu.tsx`:
- Add imports: `import { useRouter } from "next/navigation";`, `import { useAuth } from "@/lib/auth-context";`, and add `ShieldIcon` to the icons import.
- Inside the component:

```typescript
  const { me } = useAuth();
  const router = useRouter();
  const isAdmin = me?.role === "admin";

  const handleAdmin = useCallback(() => {
    close();
    router.push("/admin");
  }, [close, router]);
```

- In the desktop block, add **before** the Đăng xuất button:

```tsx
        {isAdmin && (
          <button type="button" className="header-action" onClick={handleAdmin}>
            <ShieldIcon />
            <span>Quản trị</span>
          </button>
        )}
```

- In the mobile dropdown, add the matching item **before** the Đăng xuất menuitem:

```tsx
            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                className="header-menu-item"
                onClick={handleAdmin}
              >
                <ShieldIcon />
                <span>Quản trị</span>
              </button>
            )}
```

- [ ] **Step 4: Verify gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test`
Expected: all green (HeaderMenu is rendered inside `AuthProvider` via the root layout, so `useAuth` is safe).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/auth-context.tsx frontend/src/components/header-menu.tsx frontend/src/components/icons.tsx
git commit -m "feat(frontend): expose me in auth context and show admin menu item"
```

---

### Task 7: Frontend — `/admin` layout: guard + shell + CSS

**Files:**
- Create: `frontend/src/app/admin/layout.tsx`
- Modify: `frontend/src/app/globals.css` (append admin styles)

**Interfaces:**
- Consumes: `useAuth()` → `{ me, isAuthenticated, isLoading }` (Task 6).
- Produces: an `AdminLayout` client component wrapping all `/admin/*` pages: redirects non-authed → `/login`, non-admin → `/`, renders a header (title + nav: Thống kê, Cảnh giới, ← Về game) and `children` in `<main className="admin-main">`. CSS classes `admin-shell`, `admin-header`, `admin-nav`, `admin-main`, `admin-loading`, `admin-card`, `admin-cards`, `admin-table`, `admin-error`, `admin-btn`, `admin-btn-primary` used by Tasks 8 & 10.

- [ ] **Step 1: Implement the layout**

`frontend/src/app/admin/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

// Client-side guard only — a UX convenience. Real enforcement is the
// backend's requireAuth + requireAdmin on every /admin API: a non-admin who
// bypasses this redirect sees only failing requests.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (me?.role !== "admin") {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, me, router]);

  // Until the probe resolves (or while redirecting away), show a plain
  // placeholder — deliberately not the game's animated loading screen.
  if (isLoading || me?.role !== "admin") {
    return <div className="admin-loading">Đang tải…</div>;
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1 className="admin-title">Quản trị</h1>
        <nav className="admin-nav">
          <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>
            Thống kê
          </Link>
          <Link
            href="/admin/realms"
            aria-current={pathname === "/admin/realms" ? "page" : undefined}
          >
            Cảnh giới
          </Link>
          <Link href="/">← Về game</Link>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Append admin styles to globals.css**

Append to `frontend/src/app/globals.css` (reuses the file's existing color custom properties — check the top of the file for the exact token names, e.g. gold/ink tones, and substitute if they differ from `--color-gold`/`--color-text`; keep the static, no-animation look):

```css
/* ===== Admin dashboard (static, table-first — no canvas, no GSAP) ===== */
.admin-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--color-gold, #d8b25c);
  font-size: 1.1rem;
}

.admin-shell {
  min-height: 100vh;
  background: #0d0b14;
  color: #e8e2d5;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(216, 178, 92, 0.25);
}

.admin-title {
  font-size: 1.4rem;
  color: var(--color-gold, #d8b25c);
}

.admin-nav {
  display: flex;
  gap: 20px;
}

.admin-nav a {
  color: #e8e2d5;
  text-decoration: none;
  padding: 6px 2px;
  border-bottom: 2px solid transparent;
}

.admin-nav a[aria-current="page"] {
  color: var(--color-gold, #d8b25c);
  border-bottom-color: var(--color-gold, #d8b25c);
}

.admin-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.admin-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

.admin-card {
  border: 1px solid rgba(216, 178, 92, 0.25);
  border-radius: 10px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.03);
}

.admin-card .value {
  font-size: 2rem;
  color: var(--color-gold, #d8b25c);
}

.admin-card .label {
  opacity: 0.8;
  font-size: 0.9rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-table th,
.admin-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-bar {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(90deg, #d8b25c, #8f6b2a);
  min-width: 2px;
}

.admin-error {
  border: 1px solid rgba(220, 80, 80, 0.6);
  background: rgba(220, 80, 80, 0.12);
  color: #f0b5b5;
  border-radius: 8px;
  padding: 14px;
  margin: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-btn {
  border: 1px solid rgba(216, 178, 92, 0.5);
  background: transparent;
  color: #e8e2d5;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
}

.admin-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.admin-btn-primary {
  background: rgba(216, 178, 92, 0.2);
  color: var(--color-gold, #d8b25c);
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

/* Realm editor */
.admin-realm {
  border: 1px solid rgba(216, 178, 92, 0.25);
  border-radius: 10px;
  margin-bottom: 14px;
  overflow: hidden;
}

.admin-realm-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: none;
  color: inherit;
  font-size: 1rem;
  cursor: pointer;
  text-align: left;
}

.admin-realm-body {
  padding: 12px 16px 16px;
}

.admin-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 5px;
  color: #e8e2d5;
  padding: 6px 8px;
  width: 100%;
  min-width: 70px;
}

.admin-input.invalid {
  border-color: #dc5050;
}

.admin-field-error {
  color: #f0b5b5;
  font-size: 0.78rem;
  margin-top: 3px;
}

.admin-realm-table-wrap {
  overflow-x: auto;
}
```

- [ ] **Step 3: Verify gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: green. (`/admin` renders the loading placeholder then redirects when unauthenticated — full behavior check comes in Task 11's manual pass.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/layout.tsx frontend/src/app/globals.css
git commit -m "feat(frontend): add /admin shell with client-side role guard"
```

---

### Task 8: Frontend — stats overview page

**Files:**
- Create: `frontend/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `fetchAdminStats(): Promise<AdminStats>` (Task 5), CSS classes from Task 7, `useRouter` for the auth-expired redirect.
- Produces: the default `/admin` page. No exports consumed elsewhere.

- [ ] **Step 1: Implement the page**

`frontend/src/app/admin/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchAdminStats } from "@/lib/api";
import type { AdminStats } from "@/lib/types";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tải được số liệu";
      // A refresh-proof 401 means the session is gone — back to login.
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bar widths are relative to the most-populated realm so the largest bar
  // always spans full width regardless of absolute player counts.
  const maxCount = stats
    ? Math.max(1, ...stats.realmDistribution.map((r) => r.count))
    : 1;

  return (
    <section>
      <div className="admin-toolbar">
        <h2>Thống kê tổng quan</h2>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Đang tải…" : "Làm mới"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          <span>{error}</span>
          <button type="button" className="admin-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {stats && (
        <>
          <div className="admin-cards">
            <div className="admin-card">
              <div className="value">{stats.totalUsers}</div>
              <div className="label">Tổng người chơi</div>
            </div>
            <div className="admin-card">
              <div className="value">{stats.totalAdmins}</div>
              <div className="label">Quản trị viên</div>
            </div>
            <div className="admin-card">
              <div className="value">{stats.punishedCount}</div>
              <div className="label">Đang chịu phạt</div>
            </div>
          </div>

          <h3>Phân bố cảnh giới</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cảnh giới</th>
                <th>Số người</th>
                <th style={{ width: "50%" }}>Tỉ lệ</th>
              </tr>
            </thead>
            <tbody>
              {stats.realmDistribution.map((r) => (
                <tr key={r.realmMajor}>
                  <td>{r.realmName}</td>
                  <td>{r.count}</td>
                  <td>
                    <div
                      className="admin-bar"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </td>
                </tr>
              ))}
              {stats.realmDistribution.length === 0 && (
                <tr>
                  <td colSpan={3}>Chưa có nhân vật nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm build`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page.tsx
git commit -m "feat(frontend): add admin stats overview page"
```

---

### Task 9: Frontend — pure realm-draft validation

**Files:**
- Create: `frontend/src/lib/realm-validation.ts`
- Test: `frontend/src/lib/realm-validation.test.ts`

**Interfaces:**
- Consumes: `AdminRealm`/`AdminSubStage` types (Task 5).
- Produces (Task 10's editor consumes both):
  ```typescript
  export interface RealmDraftError {
    realmIndex: number;       // -1 for config-wide errors (e.g. no realms)
    subIndex: number | null;  // null for realm-level errors
    field: string | null;     // e.g. "linhKhiRequired"; null for structural errors
    message: string;
  }
  export function validateRealmDraft(realms: AdminRealm[]): RealmDraftError[]
  export function findError(errors: RealmDraftError[], realmIndex: number, subIndex: number | null, field: string | null): RealmDraftError | undefined
  ```

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/realm-validation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { AdminRealm } from "./types";
import { findError, validateRealmDraft } from "./realm-validation";

function stage(overrides: Partial<AdminRealm["subStages"][number]> = {}) {
  return {
    name: "Sơ Kỳ",
    linhKhiRequired: 100,
    cultivationRate: 1,
    baseSuccessRate: 90,
    pityIncrement: 10,
    maxSuccessRate: 95,
    punishmentSeconds: 300,
    ...overrides,
  };
}

describe("validateRealmDraft", () => {
  it("passes a valid multi-realm config with a cross-realm linh khí reset", () => {
    const realms: AdminRealm[] = [
      {
        name: "Phàm Nhân",
        subStages: [stage({ linhKhiRequired: 100 }), stage({ name: "Viên Mãn", linhKhiRequired: 500 })],
      },
      // Starts BELOW the previous realm's peak — legal by design.
      { name: "Luyện Khí", subStages: [stage({ linhKhiRequired: 300 })] },
    ];
    expect(validateRealmDraft(realms)).toEqual([]);
  });

  it("rejects an empty config", () => {
    const errors = validateRealmDraft([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].realmIndex).toBe(-1);
  });

  it("rejects a realm with no sub-stages and an empty realm name", () => {
    const errors = validateRealmDraft([{ name: "", subStages: [] }]);
    expect(findError(errors, 0, null, "name")).toBeDefined();
    expect(findError(errors, 0, null, null)).toBeDefined(); // no sub-stages
  });

  it("rejects non-increasing linhKhiRequired within a realm, pinned to the offending stage", () => {
    const realms: AdminRealm[] = [
      {
        name: "Phàm Nhân",
        subStages: [stage({ linhKhiRequired: 100 }), stage({ name: "Trung Kỳ", linhKhiRequired: 100 })],
      },
    ];
    const errors = validateRealmDraft(realms);
    expect(findError(errors, 0, 1, "linhKhiRequired")).toBeDefined();
  });

  it("rejects out-of-range numbers and NaN", () => {
    const realms: AdminRealm[] = [
      {
        name: "Phàm Nhân",
        subStages: [
          stage({
            linhKhiRequired: Number.NaN,
            cultivationRate: 0,
            baseSuccessRate: 101,
            maxSuccessRate: -1,
            pityIncrement: -5,
            punishmentSeconds: 3.5,
          }),
        ],
      },
    ];
    const errors = validateRealmDraft(realms);
    expect(findError(errors, 0, 0, "linhKhiRequired")).toBeDefined();
    expect(findError(errors, 0, 0, "cultivationRate")).toBeDefined();
    expect(findError(errors, 0, 0, "baseSuccessRate")).toBeDefined();
    expect(findError(errors, 0, 0, "maxSuccessRate")).toBeDefined();
    expect(findError(errors, 0, 0, "pityIncrement")).toBeDefined();
    expect(findError(errors, 0, 0, "punishmentSeconds")).toBeDefined();
  });

  it("rejects an empty sub-stage name", () => {
    const realms: AdminRealm[] = [{ name: "Phàm Nhân", subStages: [stage({ name: "  " })] }];
    expect(findError(validateRealmDraft(realms), 0, 0, "name")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/lib/realm-validation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`frontend/src/lib/realm-validation.ts`:

```typescript
import type { AdminRealm } from "./types";

// Client-side mirror of the backend's PUT /admin/realms validation (zod
// per-field ranges + UpdateRealmConfigUseCase's per-realm monotonic rule), so
// the editor can pin errors to fields before a request is ever sent. The
// backend remains the authority — this only has to agree with it.
export interface RealmDraftError {
  realmIndex: number; // -1 for config-wide errors (e.g. no realms at all)
  subIndex: number | null; // null for realm-level errors
  field: string | null; // null for structural errors (e.g. no sub-stages)
  message: string;
}

export function validateRealmDraft(realms: AdminRealm[]): RealmDraftError[] {
  const errors: RealmDraftError[] = [];

  if (realms.length === 0) {
    errors.push({
      realmIndex: -1,
      subIndex: null,
      field: null,
      message: "Cần ít nhất một cảnh giới",
    });
    return errors;
  }

  realms.forEach((realm, realmIndex) => {
    if (realm.name.trim() === "") {
      errors.push({
        realmIndex,
        subIndex: null,
        field: "name",
        message: "Tên cảnh giới không được để trống",
      });
    }
    if (realm.subStages.length === 0) {
      errors.push({
        realmIndex,
        subIndex: null,
        field: null,
        message: "Cảnh giới cần ít nhất một tiểu cảnh giới",
      });
    }

    realm.subStages.forEach((sub, subIndex) => {
      const fail = (field: string, message: string) =>
        errors.push({ realmIndex, subIndex, field, message });

      if (sub.name.trim() === "") fail("name", "Tên không được để trống");
      if (!Number.isFinite(sub.linhKhiRequired) || sub.linhKhiRequired <= 0)
        fail("linhKhiRequired", "Phải là số > 0");
      if (!Number.isFinite(sub.cultivationRate) || sub.cultivationRate <= 0)
        fail("cultivationRate", "Phải là số > 0");
      if (
        !Number.isFinite(sub.baseSuccessRate) ||
        sub.baseSuccessRate < 0 ||
        sub.baseSuccessRate > 100
      )
        fail("baseSuccessRate", "Trong khoảng 0–100");
      if (
        !Number.isFinite(sub.maxSuccessRate) ||
        sub.maxSuccessRate < 0 ||
        sub.maxSuccessRate > 100
      )
        fail("maxSuccessRate", "Trong khoảng 0–100");
      if (!Number.isFinite(sub.pityIncrement) || sub.pityIncrement < 0)
        fail("pityIncrement", "Phải là số ≥ 0");
      if (
        !Number.isFinite(sub.punishmentSeconds) ||
        !Number.isInteger(sub.punishmentSeconds) ||
        sub.punishmentSeconds < 0
      )
        fail("punishmentSeconds", "Số nguyên ≥ 0");

      // Monotonic linh khí WITHIN the realm only — each new realm may reset
      // lower (the seeded balance does), matching the backend invariant.
      if (subIndex > 0) {
        const prev = realm.subStages[subIndex - 1].linhKhiRequired;
        if (
          Number.isFinite(sub.linhKhiRequired) &&
          Number.isFinite(prev) &&
          sub.linhKhiRequired <= prev
        ) {
          fail("linhKhiRequired", "Phải lớn hơn tiểu cảnh giới trước");
        }
      }
    });
  });

  return errors;
}

export function findError(
  errors: RealmDraftError[],
  realmIndex: number,
  subIndex: number | null,
  field: string | null,
): RealmDraftError | undefined {
  return errors.find(
    (e) => e.realmIndex === realmIndex && e.subIndex === subIndex && e.field === field,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/lib/realm-validation.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/realm-validation.ts frontend/src/lib/realm-validation.test.ts
git commit -m "feat(frontend): add pure realm draft validation mirroring backend invariants"
```

---

### Task 10: Frontend — realm config editor page

**Files:**
- Create: `frontend/src/app/admin/realms/page.tsx`

**Interfaces:**
- Consumes: `fetchAdminRealms`/`updateAdminRealms` (Task 5), `validateRealmDraft`/`findError` (Task 9), CSS classes from Task 7.
- Produces: the `/admin/realms` page. No exports consumed elsewhere.

- [ ] **Step 1: Implement the editor**

`frontend/src/app/admin/realms/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAdminRealms, updateAdminRealms } from "@/lib/api";
import { findError, validateRealmDraft } from "@/lib/realm-validation";
import type { AdminRealm, AdminSubStage } from "@/lib/types";

// Numeric tunable columns, in display order. name is handled separately.
const NUMERIC_FIELDS: { key: keyof AdminSubStage; label: string }[] = [
  { key: "linhKhiRequired", label: "Linh khí cần" },
  { key: "cultivationRate", label: "Tốc độ tu" },
  { key: "baseSuccessRate", label: "Tỉ lệ gốc (%)" },
  { key: "pityIncrement", label: "Cộng dồn (%)" },
  { key: "maxSuccessRate", label: "Tỉ lệ tối đa (%)" },
  { key: "punishmentSeconds", label: "Phạt (giây)" },
];

function emptyStage(): AdminSubStage {
  return {
    name: "Tân Kỳ",
    linhKhiRequired: 1,
    cultivationRate: 1,
    baseSuccessRate: 90,
    pityIncrement: 10,
    maxSuccessRate: 95,
    punishmentSeconds: 300,
  };
}

export default function AdminRealmsPage() {
  const [server, setServer] = useState<AdminRealm[] | null>(null);
  const [draft, setDraft] = useState<AdminRealm[] | null>(null);
  const [openRealms, setOpenRealms] = useState<Set<number>>(new Set([0]));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const router = useRouter();

  const dirty = useMemo(
    () => draft !== null && JSON.stringify(draft) !== JSON.stringify(server),
    [draft, server],
  );
  const errors = useMemo(() => (draft ? validateRealmDraft(draft) : []), [draft]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { realms } = await fetchAdminRealms();
      setServer(realms);
      setDraft(structuredClone(realms));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Không tải được cấu hình";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      setLoadError(message);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warn on tab close / hard navigation while edits are unsaved. In-app nav
  // via the header links is not intercepted (Next App Router has no route
  // guard API) — beforeunload covers the destructive cases (close, reload).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // All draft edits go through one immutable updater so React re-renders and
  // the dirty/validation memos recompute.
  const updateDraft = useCallback((fn: (draft: AdminRealm[]) => AdminRealm[]) => {
    setDraft((d) => (d ? fn(structuredClone(d)) : d));
  }, []);

  const setRealmName = (ri: number, name: string) =>
    updateDraft((d) => {
      d[ri].name = name;
      return d;
    });

  const setSubField = (ri: number, si: number, key: keyof AdminSubStage, raw: string) =>
    updateDraft((d) => {
      const sub = d[ri].subStages[si];
      if (key === "name") {
        sub.name = raw;
      } else {
        // Empty input → NaN → caught by validation (Save disabled) instead of
        // silently coercing to 0.
        (sub[key] as number) = raw === "" ? Number.NaN : Number(raw);
      }
      return d;
    });

  const addRealm = () =>
    updateDraft((d) => {
      d.push({ name: "Cảnh giới mới", subStages: [emptyStage()] });
      return d;
    });

  const removeRealm = (ri: number) =>
    updateDraft((d) => {
      d.splice(ri, 1);
      return d;
    });

  const addSubStage = (ri: number) =>
    updateDraft((d) => {
      const stages = d[ri].subStages;
      const last = stages[stages.length - 1];
      const next = emptyStage();
      if (last) {
        // Start from the previous stage's values so the monotonic rule holds
        // out of the box and the admin only tweaks deltas.
        Object.assign(next, last, { name: "Tân Kỳ", linhKhiRequired: last.linhKhiRequired * 1.5 });
      }
      stages.push(next);
      return d;
    });

  const removeSubStage = (ri: number, si: number) =>
    updateDraft((d) => {
      d[ri].subStages.splice(si, 1);
      return d;
    });

  const toggleRealm = (ri: number) =>
    setOpenRealms((s) => {
      const next = new Set(s);
      if (next.has(ri)) next.delete(ri);
      else next.add(ri);
      return next;
    });

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { realms } = await updateAdminRealms(draft);
      // Re-sync both copies from the server's accepted version.
      setServer(realms);
      setDraft(structuredClone(realms));
      setSavedAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lưu thất bại";
      if (message === "Authentication expired") {
        router.replace("/login");
        return;
      }
      // Draft stays intact — the admin fixes and retries without losing edits.
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, router]);

  const undo = () => {
    if (server) setDraft(structuredClone(server));
    setSaveError(null);
  };

  if (loadError) {
    return (
      <div className="admin-error">
        <span>{loadError}</span>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!draft) return <p>Đang tải cấu hình…</p>;

  const globalError = findError(errors, -1, null, null);

  return (
    <section>
      <div className="admin-toolbar">
        <h2>Cấu hình cảnh giới</h2>
        <button type="button" className="admin-btn" onClick={addRealm}>
          + Thêm cảnh giới
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={undo}
          disabled={!dirty || saving}
        >
          Hoàn tác
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => void save()}
          disabled={!dirty || errors.length > 0 || saving}
        >
          {saving ? "Đang lưu…" : "Lưu tất cả"}
        </button>
        {savedAt && !dirty && <span>Đã lưu lúc {savedAt.toLocaleTimeString("vi-VN")}</span>}
      </div>

      {saveError && (
        <div className="admin-error">
          <span>{saveError}</span>
        </div>
      )}
      {globalError && (
        <div className="admin-error">
          <span>{globalError.message}</span>
        </div>
      )}

      {draft.map((realm, ri) => {
        const realmNameError = findError(errors, ri, null, "name");
        const noStagesError = findError(errors, ri, null, null);
        const open = openRealms.has(ri);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: realms are an ordered, index-addressed draft — the index IS the identity the backend stores.
          <div className="admin-realm" key={ri}>
            <button
              type="button"
              className="admin-realm-head"
              aria-expanded={open}
              onClick={() => toggleRealm(ri)}
            >
              <span>
                #{ri} — {realm.name || "(chưa có tên)"} · {realm.subStages.length} tiểu cảnh giới
              </span>
              <span>{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="admin-realm-body">
                <label>
                  Tên cảnh giới{" "}
                  <input
                    className={`admin-input${realmNameError ? " invalid" : ""}`}
                    style={{ maxWidth: 260 }}
                    value={realm.name}
                    onChange={(e) => setRealmName(ri, e.target.value)}
                  />
                </label>
                {realmNameError && (
                  <div className="admin-field-error">{realmNameError.message}</div>
                )}
                {noStagesError && (
                  <div className="admin-field-error">{noStagesError.message}</div>
                )}

                <div className="admin-realm-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        {NUMERIC_FIELDS.map((f) => (
                          <th key={f.key}>{f.label}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {realm.subStages.map((sub, si) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: sub-stages are index-addressed draft rows.
                        <tr key={si}>
                          <td>
                            <input
                              className={`admin-input${findError(errors, ri, si, "name") ? " invalid" : ""}`}
                              value={sub.name}
                              onChange={(e) => setSubField(ri, si, "name", e.target.value)}
                            />
                            {findError(errors, ri, si, "name") && (
                              <div className="admin-field-error">
                                {findError(errors, ri, si, "name")?.message}
                              </div>
                            )}
                          </td>
                          {NUMERIC_FIELDS.map((f) => {
                            const err = findError(errors, ri, si, f.key);
                            const value = sub[f.key] as number;
                            return (
                              <td key={f.key}>
                                <input
                                  type="number"
                                  className={`admin-input${err ? " invalid" : ""}`}
                                  value={Number.isNaN(value) ? "" : value}
                                  onChange={(e) => setSubField(ri, si, f.key, e.target.value)}
                                />
                                {err && <div className="admin-field-error">{err.message}</div>}
                              </td>
                            );
                          })}
                          <td>
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() => removeSubStage(ri, si)}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="admin-toolbar" style={{ marginTop: 10 }}>
                  <button type="button" className="admin-btn" onClick={() => addSubStage(ri)}>
                    + Thêm tiểu cảnh giới
                  </button>
                  <button type="button" className="admin-btn" onClick={() => removeRealm(ri)}>
                    Xóa cảnh giới này
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

Note: if `pnpm lint` flags the `biome-ignore` comments as unneeded (rule config may differ), remove them; if it flags the array-index keys, keep the ignores. Follow whatever Biome actually reports.

- [ ] **Step 2: Verify gate**

Run: `cd frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/realms/page.tsx
git commit -m "feat(frontend): add realm config editor with draft state and inline validation"
```

---

### Task 11: Docs + full verification gate

**Files:**
- Modify: `CLAUDE.md` (new "Admin Dashboard Phase 1" section)

**Interfaces:**
- Consumes: everything above.
- Produces: verified, documented feature.

- [ ] **Step 1: Full automated gate**

```bash
cd backend && docker compose up -d --build && npm test && npx tsc --noEmit
cd ../frontend && pnpm lint && pnpm tsc --noEmit && pnpm test && pnpm build
```
Expected: backend 182 tests green; frontend 41 tests (32 + 3 api + 6 validation) green, build clean. Run the backend suite twice if any single failure appears (known cross-suite seed race; two consecutive clean runs = stable).

- [ ] **Step 2: Manual verification against Docker (spec's checklist)**

With backend up on `:5000` and `cd frontend && pnpm dev` on `:3000`:

1. Register `admincheck` via UI, promote: `docker compose exec db psql -U game -d tu_tien_chi_lo -c "UPDATE \"User\" SET role='admin' WHERE username='admincheck';"`, logout + login again (token must carry the role).
2. Game header shows "Quản trị" (desktop inline AND mobile hamburger).
3. `/admin`: three cards + realm distribution match a quick psql count.
4. `/admin/realms`: edit realm 0 sub 0 `linhKhiRequired` → Lưu tất cả → as a player (cookie jar or second browser profile), `GET /cultivation/state` shows the new requirement immediately.
5. Set a sub-stage's linhKhi below its predecessor → inline red error, Save disabled.
6. Register a normal user: no "Quản trị" item; direct `/admin` → redirected to `/`; `curl` GET `/admin/stats` with their cookie → 403.
7. `GET /auth/me` without cookies → 401.

Restore the seeded value (repeat the edit back, or `cd backend && npm run db:seed`) and remove verification users if any test data lingers.

- [ ] **Step 3: Update CLAUDE.md**

Append an "Admin Dashboard Phase 1" section covering: `GET /auth/me` (role from token, `USER_NOT_FOUND`→401), `GET /admin/stats` (StatsRepository port, `Realm #N` fallback), frontend `/admin` shell (client guard = UX only, backend enforces), `me` in auth-context (probe switched from `/cultivation/state` to `/auth/me`), realm editor draft model + `realm-validation.ts` mirror, test counts, and the manual verification results.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record admin dashboard phase 1 in CLAUDE.md"
```

---

## Self-Review (completed)

- **Spec coverage:** `GET /auth/me` → Tasks 1–2; `GET /admin/stats` (port/use case/adapter/route) → Tasks 3–4; api client + types → Task 5; `me` in context + menu item → Task 6; guard + shell → Task 7; stats page → Task 8; validation → Task 9; editor (draft/save/undo/beforeunload/error banner) → Task 10; verification checklist → Task 11. Out-of-scope items untouched.
- **Deviations from spec, both deliberate:** (1) sub-stage DTO field is `name` (real API), not `subStageName` (spec prose slip); (2) the auth-context probe endpoint switches to `/auth/me` — same semantics, one fewer request than probing state *and* fetching role.
- **Type consistency:** `CurrentUserOutput`/`Me`, `AdminStatsOutput`/`AdminStats`, `RealmCount`, `RealmDistributionEntry`, `AdminRealm`/`AdminSubStage`, `RealmDraftError` names match across producing and consuming tasks; `AuthRouterDeps`/`AdminRouterDeps` extensions match the `app.ts` call sites.
