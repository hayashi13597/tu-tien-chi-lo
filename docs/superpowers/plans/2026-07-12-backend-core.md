# Backend Core (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 backend for Tu Tiên Chi Lộ: a cultivation-game REST API with basic JWT auth (register/login) and the tu luyện & đột phá cảnh giới mechanic (automatic linh khí accumulation, pity-based breakthrough across 12 realms × 4 sub-stages), organized as Clean Architecture.

**Architecture:** Express + TypeScript REST API, PostgreSQL via Prisma, built inside-out: pure domain logic first (zero dependencies), then application use cases (unit-tested against in-memory fakes), then infrastructure adapters (Prisma repositories, bcrypt, JWT — integration-tested against real Postgres), then presentation (Express routes/middleware) wiring everything together last.

**Tech Stack:** Node.js, TypeScript, Express ^4.19.2, Prisma ^5.20.0, PostgreSQL, `jsonwebtoken` ^9.0.2, `bcrypt` ^5.1.1, `zod` ^3.23.8, Vitest ^2.1.1 + Supertest ^7.0.0, Docker Compose (dev environment).

**Spec:** `docs/superpowers/specs/2026-07-12-backend-core-design.md`

## Global Constraints

- All backend code lives under `backend/` at the repo root.
- **Clean Architecture, dependencies point inward only:**
  - `domain/` — entities + pure business logic. Zero framework/library imports. Defines ports (interfaces) that outer layers implement. Never imports from `infrastructure/` or `presentation/`.
  - `application/` — use cases orchestrating domain logic. Depends only on `domain/` ports/entities/errors — never imports Prisma/Express/jsonwebtoken/bcrypt directly. (Static config data such as `infrastructure/config/realms.ts` is an accepted exception — it's a literal data constant, not an I/O adapter.)
  - `infrastructure/` — concrete port implementations: Prisma repositories, bcrypt hasher, JWT token service, realm config data, Prisma client singleton.
  - `presentation/` — Express routes, controllers, middleware, Zod request schemas. Translates HTTP ↔ use case input/output. No business logic.
  - A composition root (`src/app.ts`) is the only place that instantiates concrete infrastructure and injects it into use cases and controllers.
- **Comment non-trivial logic clearly.** Every formula, state transition, and concurrency-handling step (lazy linh khí accumulation, pity success-rate formula, stage rollover, optimistic-concurrency guard) must have a comment explaining the *why* and the mechanics — not just what the code does.
- **Update `CLAUDE.md` after every task.** Each task below ends with a step to append a short note to `CLAUDE.md` describing what that task added (new layer contents, new commands, new env vars). Do this before the commit step.
- **Use `ctx7` (context7) before writing library-specific code.** Before using an API from `express`, `@prisma/client`, `jsonwebtoken`, `bcrypt`, `zod`, or `vitest`/`supertest`, check current docs via `ctx7` and confirm the API shape matches the version pinned in `package.json` — do not rely on memorized API shapes.
- 12 realms, 4 sub-stages each (Sơ, Trung, Viên Mãn, Đại Viên Mãn) — order: Phàm Nhân, Luyện Khí, Trúc Cơ, Kết Đan, Nguyên Anh, Hóa Thần, Phá Hư, Đại Thừa, Độ Kiếp, Chân Tiên, Kim Tiên, Thái Ất. Numeric values are literal, hand-declared in `backend/src/infrastructure/config/realms.ts` (spec section 10) — never computed at runtime.
- `MAX_REALM_MAJOR` is always derived as `REALMS.length - 1`, never hardcoded elsewhere.
- Offline linh khí accumulation caps at 24 hours (`OFFLINE_CAP_SECONDS = 24 * 60 * 60`).
- `GET /cultivation/state` never writes to the database. `POST /cultivation/breakthrough` always persists the freshly computed linh khí as its first write, on every code path, including all three rejection paths (max stage, punished, insufficient linh khí).
- On breakthrough success, excess linh khí carries over (`linhKhi - linhKhiRequired`, never reset to 0); `breakthroughFails` resets to 0; `punishedUntil` clears.
- On breakthrough failure, linh khí is never deducted; `breakthroughFails += 1`; `punishedUntil = now + punishmentSeconds`.
- **Error handling:** business/application errors are thrown as `DomainError(code, message)` — a plain domain-level error with no HTTP status (status is an HTTP/presentation concern, so it's deliberately kept out of `domain/`). `presentation/middleware/errorHandler.ts` is the single place that maps `DomainError.code` to an HTTP status and renders the unified `{ error: { code, message } }` JSON shape. This preserves the spec's exact HTTP contract while keeping `application/` free of any HTTP-layer concept.
- `requireAuth` middleware is a factory (`createRequireAuth(tokenService)`) so it depends on the `TokenService` port, not directly on `jsonwebtoken` — it writes its own 401 JSON response directly (not via `next(err)`) since it runs before a route handler's try/catch exists, matching the unified error shape without going through `DomainError`.
- `vitest.config.ts` sets `fileParallelism: false` from the start: all integration tests share one dev Postgres database and clean up via `deleteMany()` in `beforeEach`, so concurrent file execution causes cross-file races.
- Every route handler follows `try { ... } catch (err) { next(err); }`, delegating to `errorHandler`.

---

### Task 1: Project scaffolding & Docker dev environment

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`
- Create: `backend/.dockerignore`
- Create: `backend/.env.example`
- Create: `backend/.env` (local only, copied from `.env.example`, not committed)
- Create: `backend/Dockerfile`
- Create: `backend/docker-compose.yml`
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/setup.ts`
- Create: `backend/prisma/schema.prisma` (stub — datasource + generator only, no models yet)
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` (exported from `src/app.ts`) — used by every later route-mounting task and by integration tests via Supertest.
- Produces: `GET /health` → `200 { status: 'ok' }`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "tu-tien-chi-lo-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "prisma generate && tsx watch src/server.ts",
    "build": "prisma generate && tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@prisma/client": "^5.20.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "vitest": "^2.1.1",
    "supertest": "^7.0.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.2",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 4: Create `backend/.dockerignore`**

```
node_modules
dist
.env
.git
```

- [ ] **Step 5: Create `backend/.env.example`**

```
DATABASE_URL=postgresql://game:game@localhost:5432/tu_tien_chi_lo
JWT_SECRET=dev-secret-change-me
PORT=3000
```

- [ ] **Step 6: Copy it to a local `.env`**

Run: `cp backend/.env.example backend/.env`

- [ ] **Step 7: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 8: Create `backend/docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: game
      POSTGRES_PASSWORD: game
      POSTGRES_DB: tu_tien_chi_lo
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

  api:
    build: .
    command: npm run dev
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://game:game@db:5432/tu_tien_chi_lo
      JWT_SECRET: dev-secret-change-me
      PORT: 3000
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma
    depends_on:
      - db

volumes:
  db_data:
```

- [ ] **Step 9: Create the Prisma stub `backend/prisma/schema.prisma`**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

(No models yet — Task 2 adds `User` and `Character` and runs the first migration. This stub lets `prisma generate` succeed now so the app can boot.)

- [ ] **Step 10: Create `backend/src/app.ts`**

```ts
import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
```

- [ ] **Step 11: Create `backend/src/server.ts`**

```ts
import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

- [ ] **Step 12: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share one dev Postgres DB and clean up via deleteMany()
    // in beforeEach; running test files in parallel causes cross-file races.
    fileParallelism: false,
  },
});
```

- [ ] **Step 13: Create `backend/tests/setup.ts`**

```ts
import 'dotenv/config';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
```

- [ ] **Step 14: Install dependencies locally**

Run: `cd backend && npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 15: Build and start the dev environment with Docker Compose**

Run: `cd backend && docker compose up -d --build`
Expected: two containers running (`backend-db-1`, `backend-api-1`); `docker compose logs api` shows `Server listening on port 3000`.

- [ ] **Step 16: Verify the health endpoint**

Run: `curl -s http://localhost:3000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 17: Update CLAUDE.md**

Append a short note under a "## Backend Progress" heading (create it if absent): "Task 1: scaffolded Express+TypeScript backend with Docker Compose dev environment (`api` + `db` services). Commands: `cd backend && docker compose up -d --build`, `npm test`."

- [ ] **Step 18: Commit**

```bash
git add backend/ CLAUDE.md
git commit -m "chore: scaffold backend project with Docker dev environment"
```

---

### Task 2: Prisma schema — User & Character models

**Files:**
- Modify: `backend/prisma/schema.prisma` (replace stub with full models)
- Create: `backend/src/infrastructure/db/prisma.ts`
- Test: `backend/tests/integration/prisma-schema.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `prisma` client singleton from `src/infrastructure/db/prisma.ts` — consumed by Task 11's repositories. Produces Prisma models `User { id, username, passwordHash, createdAt, character }` and `Character { id, userId, realmMajor, realmSub, linhKhi, lastUpdateAt, breakthroughFails, punishedUntil, createdAt }`.

- [ ] **Step 1: Replace `backend/prisma/schema.prisma` with the full schema**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String     @id @default(uuid())
  username     String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  character    Character?
}

model Character {
  id                String    @id @default(uuid())
  userId            String    @unique
  user              User      @relation(fields: [userId], references: [id])

  realmMajor        Int       @default(0)
  realmSub          Int       @default(0)
  linhKhi           Float     @default(0)
  lastUpdateAt      DateTime  @default(now())

  breakthroughFails Int       @default(0)
  punishedUntil     DateTime?

  createdAt         DateTime  @default(now())
}
```

(`linhKhi` uses `Float`, not `Decimal` — comfortably covers the largest realm requirement (~88.5 million) with no precision issues, and avoids `Decimal.js` arithmetic in application code, per spec section 4.)

- [ ] **Step 2: Create `backend/src/infrastructure/db/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: Ensure the dev database is running**

Run: `cd backend && docker compose up -d db`

- [ ] **Step 4: Run the first migration**

Run: `cd backend && npx prisma migrate dev --name init`
Expected: migration files created under `prisma/migrations/`, output ends with `Your database is now in sync with your schema.`

- [ ] **Step 5: Write the failing integration test**

Create `backend/tests/integration/prisma-schema.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Prisma schema', () => {
  it('creates a user with a linked character using default values', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'schema-test-user',
        passwordHash: 'hashed',
        character: {
          create: {},
        },
      },
      include: { character: true },
    });

    expect(user.character?.realmMajor).toBe(0);
    expect(user.character?.realmSub).toBe(0);
    expect(user.character?.linhKhi).toBe(0);
    expect(user.character?.punishedUntil).toBeNull();
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/integration/prisma-schema.test.ts`
Expected: PASS (this test only needs the migration applied, not any application code yet)

- [ ] **Step 7: Update CLAUDE.md**

Append: "Task 2: added `User`/`Character` Prisma models (`prisma/schema.prisma`) and the Prisma client singleton (`src/infrastructure/db/prisma.ts`). Run `npx prisma migrate dev --name init` after a fresh clone."

- [ ] **Step 8: Commit**

```bash
git add backend/prisma backend/src/infrastructure/db/prisma.ts backend/tests/integration/prisma-schema.test.ts CLAUDE.md
git commit -m "feat: add User and Character Prisma models"
```

---

### Task 3: Realm configuration (12 realms × 4 sub-stages)

**Files:**
- Create: `backend/src/infrastructure/config/realms.ts`
- Test: `backend/tests/unit/realms.test.ts`

**Interfaces:**
- Produces: `interface SubStageConfig { name: string; linhKhiRequired: number; cultivationRate: number; baseSuccessRate: number; pityIncrement: number; maxSuccessRate: number; punishmentSeconds: number; }`
- Produces: `interface RealmConfig { name: string; subStages: [SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig]; }`
- Produces: `REALMS: RealmConfig[]` (12 entries), `MAX_REALM_MAJOR: number` (= 11) — consumed by Task 8's and Task 9's use cases.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/realms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { REALMS, MAX_REALM_MAJOR } from '../../src/infrastructure/config/realms';

describe('realms config', () => {
  it('has 12 realms, each with exactly 4 substages', () => {
    expect(REALMS).toHaveLength(12);
    for (const realm of REALMS) {
      expect(realm.subStages).toHaveLength(4);
    }
  });

  it('derives MAX_REALM_MAJOR from the array length', () => {
    expect(MAX_REALM_MAJOR).toBe(REALMS.length - 1);
    expect(MAX_REALM_MAJOR).toBe(11);
  });

  it('names the realms in the expected cultivation order', () => {
    expect(REALMS.map((r) => r.name)).toEqual([
      'Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần',
      'Phá Hư', 'Đại Thừa', 'Độ Kiếp', 'Chân Tiên', 'Kim Tiên', 'Thái Ất',
    ]);
  });

  it('has non-increasing pityIncrement as realmMajor increases', () => {
    for (let i = 1; i < REALMS.length; i++) {
      const prevPity = REALMS[i - 1].subStages[0].pityIncrement;
      const currPity = REALMS[i].subStages[0].pityIncrement;
      expect(currPity).toBeLessThanOrEqual(prevPity);
    }
  });

  it('has strictly increasing linhKhiRequired within each realm', () => {
    for (const realm of REALMS) {
      for (let i = 1; i < realm.subStages.length; i++) {
        expect(realm.subStages[i].linhKhiRequired).toBeGreaterThan(realm.subStages[i - 1].linhKhiRequired);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/realms.test.ts`
Expected: FAIL with a module-not-found error for `../../src/infrastructure/config/realms`

- [ ] **Step 3: Create `backend/src/infrastructure/config/realms.ts`**

```ts
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
  subStages: [SubStageConfig, SubStageConfig, SubStageConfig, SubStageConfig];
}

export const REALMS: RealmConfig[] = [
  {
    name: 'Phàm Nhân',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 100, cultivationRate: 1.00, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      { name: 'Trung', linhKhiRequired: 200, cultivationRate: 1.15, baseSuccessRate: 87, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 600 },
      { name: 'Viên Mãn', linhKhiRequired: 350, cultivationRate: 1.30, baseSuccessRate: 84, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 500, cultivationRate: 1.45, baseSuccessRate: 81, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 1200 },
    ],
  },
  {
    name: 'Luyện Khí',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 300, cultivationRate: 1.60, baseSuccessRate: 84, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1500 },
      { name: 'Trung', linhKhiRequired: 600, cultivationRate: 1.84, baseSuccessRate: 81, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 1800 },
      { name: 'Viên Mãn', linhKhiRequired: 1050, cultivationRate: 2.08, baseSuccessRate: 78, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 1500, cultivationRate: 2.32, baseSuccessRate: 75, pityIncrement: 9.3, maxSuccessRate: 95, punishmentSeconds: 2400 },
    ],
  },
  {
    name: 'Trúc Cơ',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 900, cultivationRate: 2.56, baseSuccessRate: 78, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 2700 },
      { name: 'Trung', linhKhiRequired: 1800, cultivationRate: 2.94, baseSuccessRate: 75, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3000 },
      { name: 'Viên Mãn', linhKhiRequired: 3150, cultivationRate: 3.33, baseSuccessRate: 72, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3300 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 4500, cultivationRate: 3.71, baseSuccessRate: 69, pityIncrement: 8.6, maxSuccessRate: 95, punishmentSeconds: 3600 },
    ],
  },
  {
    name: 'Kết Đan',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 2700, cultivationRate: 4.10, baseSuccessRate: 72, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 3900 },
      { name: 'Trung', linhKhiRequired: 5400, cultivationRate: 4.71, baseSuccessRate: 69, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4200 },
      { name: 'Viên Mãn', linhKhiRequired: 9450, cultivationRate: 5.32, baseSuccessRate: 66, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4500 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 13500, cultivationRate: 5.94, baseSuccessRate: 63, pityIncrement: 7.9, maxSuccessRate: 95, punishmentSeconds: 4800 },
    ],
  },
  {
    name: 'Nguyên Anh',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 8100, cultivationRate: 6.55, baseSuccessRate: 66, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5100 },
      { name: 'Trung', linhKhiRequired: 16200, cultivationRate: 7.54, baseSuccessRate: 63, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5400 },
      { name: 'Viên Mãn', linhKhiRequired: 28350, cultivationRate: 8.52, baseSuccessRate: 60, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 5700 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 40500, cultivationRate: 9.50, baseSuccessRate: 57, pityIncrement: 7.2, maxSuccessRate: 95, punishmentSeconds: 6000 },
    ],
  },
  {
    name: 'Hóa Thần',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 24300, cultivationRate: 10.49, baseSuccessRate: 60, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6300 },
      { name: 'Trung', linhKhiRequired: 48600, cultivationRate: 12.06, baseSuccessRate: 57, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6600 },
      { name: 'Viên Mãn', linhKhiRequired: 85050, cultivationRate: 13.63, baseSuccessRate: 54, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 6900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 121500, cultivationRate: 15.20, baseSuccessRate: 51, pityIncrement: 6.5, maxSuccessRate: 95, punishmentSeconds: 7200 },
    ],
  },
  {
    name: 'Phá Hư',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 72900, cultivationRate: 16.78, baseSuccessRate: 54, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7500 },
      { name: 'Trung', linhKhiRequired: 145800, cultivationRate: 19.29, baseSuccessRate: 51, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 7800 },
      { name: 'Viên Mãn', linhKhiRequired: 255150, cultivationRate: 21.81, baseSuccessRate: 48, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 364500, cultivationRate: 24.33, baseSuccessRate: 45, pityIncrement: 5.8, maxSuccessRate: 95, punishmentSeconds: 8400 },
    ],
  },
  {
    name: 'Đại Thừa',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 218700, cultivationRate: 26.84, baseSuccessRate: 48, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 8700 },
      { name: 'Trung', linhKhiRequired: 437400, cultivationRate: 30.87, baseSuccessRate: 45, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9000 },
      { name: 'Viên Mãn', linhKhiRequired: 765450, cultivationRate: 34.90, baseSuccessRate: 42, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9300 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 1093500, cultivationRate: 38.92, baseSuccessRate: 39, pityIncrement: 5.1, maxSuccessRate: 95, punishmentSeconds: 9600 },
    ],
  },
  {
    name: 'Độ Kiếp',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 656100, cultivationRate: 42.95, baseSuccessRate: 42, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 9900 },
      { name: 'Trung', linhKhiRequired: 1312200, cultivationRate: 49.39, baseSuccessRate: 39, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10200 },
      { name: 'Viên Mãn', linhKhiRequired: 2296350, cultivationRate: 55.83, baseSuccessRate: 36, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10500 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 3280500, cultivationRate: 62.28, baseSuccessRate: 33, pityIncrement: 4.4, maxSuccessRate: 95, punishmentSeconds: 10800 },
    ],
  },
  {
    name: 'Chân Tiên',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 1968300, cultivationRate: 68.72, baseSuccessRate: 36, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11100 },
      { name: 'Trung', linhKhiRequired: 3936600, cultivationRate: 79.03, baseSuccessRate: 33, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11400 },
      { name: 'Viên Mãn', linhKhiRequired: 6889050, cultivationRate: 89.34, baseSuccessRate: 30, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 11700 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 9841500, cultivationRate: 99.64, baseSuccessRate: 27, pityIncrement: 3.7, maxSuccessRate: 95, punishmentSeconds: 12000 },
    ],
  },
  {
    name: 'Kim Tiên',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 5904900, cultivationRate: 109.95, baseSuccessRate: 30, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12300 },
      { name: 'Trung', linhKhiRequired: 11809800, cultivationRate: 126.44, baseSuccessRate: 27, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12600 },
      { name: 'Viên Mãn', linhKhiRequired: 20667150, cultivationRate: 142.94, baseSuccessRate: 24, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 12900 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 29524500, cultivationRate: 159.43, baseSuccessRate: 21, pityIncrement: 3.0, maxSuccessRate: 95, punishmentSeconds: 13200 },
    ],
  },
  {
    name: 'Thái Ất',
    subStages: [
      { name: 'Sơ', linhKhiRequired: 17714700, cultivationRate: 175.92, baseSuccessRate: 24, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13500 },
      { name: 'Trung', linhKhiRequired: 35429400, cultivationRate: 202.31, baseSuccessRate: 21, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 13800 },
      { name: 'Viên Mãn', linhKhiRequired: 62001450, cultivationRate: 228.70, baseSuccessRate: 18, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14100 },
      { name: 'Đại Viên Mãn', linhKhiRequired: 88573500, cultivationRate: 255.09, baseSuccessRate: 15, pityIncrement: 2.3, maxSuccessRate: 95, punishmentSeconds: 14400 },
    ],
  },
];

export const MAX_REALM_MAJOR = REALMS.length - 1;
```

This is the exact literal data from spec section 10 (`docs/superpowers/specs/2026-07-12-backend-core-design.md`) — the numbers are a settled decision, not to be re-tuned in this task.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/realms.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Update CLAUDE.md**

Append: "Task 3: added realm/sub-stage config (`src/infrastructure/config/realms.ts`) — 12 realms × 4 substages, literal tunable data, `MAX_REALM_MAJOR` derived from array length."

- [ ] **Step 6: Commit**

```bash
git add backend/src/infrastructure/config/realms.ts backend/tests/unit/realms.test.ts CLAUDE.md
git commit -m "feat: add 12-realm x 4-substage cultivation config"
```

---

### Task 4: Domain — lazy linh khí calculation (pure function)

**Files:**
- Create: `backend/src/domain/cultivation/cultivation.calc.ts`
- Test: `backend/tests/unit/cultivation.calc.test.ts`

**Interfaces:**
- Produces: `OFFLINE_CAP_SECONDS: number` (86400), `computeLinhKhi(params: { storedLinhKhi: number; lastUpdateAt: Date; now: Date; cultivationRate: number; offlineCapSeconds?: number }): number` — consumed by Task 8's `GetCultivationStateUseCase` and Task 9's `AttemptBreakthroughUseCase`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/cultivation.calc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLinhKhi, OFFLINE_CAP_SECONDS } from '../../src/domain/cultivation/cultivation.calc';

describe('computeLinhKhi', () => {
  it('adds elapsed time times rate to stored linh khi', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-01T00:00:10.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 100, lastUpdateAt, now, cultivationRate: 2 });
    expect(result).toBe(120);
  });

  it('returns the stored value unchanged when no time has elapsed', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 50, lastUpdateAt, now: lastUpdateAt, cultivationRate: 5 });
    expect(result).toBe(50);
  });

  it('caps elapsed time at OFFLINE_CAP_SECONDS by default', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-03T00:00:00.000Z'); // 48 hours later
    const result = computeLinhKhi({ storedLinhKhi: 0, lastUpdateAt, now, cultivationRate: 1 });
    expect(result).toBe(OFFLINE_CAP_SECONDS);
  });

  it('never goes backwards if now is before lastUpdateAt', () => {
    const lastUpdateAt = new Date('2026-01-01T00:00:10.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');
    const result = computeLinhKhi({ storedLinhKhi: 10, lastUpdateAt, now, cultivationRate: 3 });
    expect(result).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/cultivation.calc.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 3: Create `backend/src/domain/cultivation/cultivation.calc.ts`**

```ts
// Linh khí accrues continuously and lazily: rather than a cron job ticking
// every character forward, we recompute "what would linh khí be right now"
// from the last persisted snapshot every time a request needs it. This keeps
// GET /cultivation/state cheap to poll (no writes) and never loses progress.
export const OFFLINE_CAP_SECONDS = 24 * 60 * 60;

export function computeLinhKhi(params: {
  storedLinhKhi: number;
  lastUpdateAt: Date;
  now: Date;
  cultivationRate: number;
  offlineCapSeconds?: number;
}): number {
  const cap = params.offlineCapSeconds ?? OFFLINE_CAP_SECONDS;
  const elapsedSeconds = Math.max(0, (params.now.getTime() - params.lastUpdateAt.getTime()) / 1000);
  // Cap accrual at `cap` seconds (24h) so a character offline for a week doesn't
  // accrue a week's worth of linh khí in one lazy recomputation.
  const cappedSeconds = Math.min(elapsedSeconds, cap);
  return params.storedLinhKhi + cappedSeconds * params.cultivationRate;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/cultivation.calc.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Update CLAUDE.md**

Append: "Task 4: added lazy linh khí accumulation formula (`src/domain/cultivation/cultivation.calc.ts`), pure and framework-free per the Clean Architecture `domain/` rule."

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/cultivation/cultivation.calc.ts backend/tests/unit/cultivation.calc.test.ts CLAUDE.md
git commit -m "feat: add lazy linh khi accumulation formula"
```

---

### Task 5: Domain — breakthrough pity & stage-transition logic (pure functions)

**Files:**
- Create: `backend/src/domain/breakthrough/breakthrough.calc.ts`
- Test: `backend/tests/unit/breakthrough.calc.test.ts`

**Interfaces:**
- Consumes: nothing (pure, standalone).
- Produces: `computeSuccessRate(params: { baseSuccessRate: number; pityIncrement: number; maxSuccessRate: number; breakthroughFails: number }): number`, `rollSuccess(successRatePercent: number, randomValue: number): boolean`, `nextStage(realmMajor: number, realmSub: number): { realmMajor: number; realmSub: number }`, `isMaxStage(realmMajor: number, realmSub: number, maxRealmMajor: number): boolean` — all consumed by Task 8's and Task 9's use cases.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/breakthrough.calc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSuccessRate, rollSuccess, nextStage, isMaxStage } from '../../src/domain/breakthrough/breakthrough.calc';

describe('computeSuccessRate', () => {
  it('adds pityIncrement per failure to baseSuccessRate', () => {
    const rate = computeSuccessRate({ baseSuccessRate: 50, pityIncrement: 5, maxSuccessRate: 95, breakthroughFails: 3 });
    expect(rate).toBe(65);
  });

  it('caps the result at maxSuccessRate', () => {
    const rate = computeSuccessRate({ baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, breakthroughFails: 5 });
    expect(rate).toBe(95);
  });
});

describe('rollSuccess', () => {
  it('succeeds when the random roll lands below the success rate', () => {
    expect(rollSuccess(80, 0.5)).toBe(true);
  });

  it('fails when the random roll lands at or above the success rate', () => {
    expect(rollSuccess(30, 0.5)).toBe(false);
  });
});

describe('nextStage', () => {
  it('advances the substage within the same realm', () => {
    expect(nextStage(1, 0)).toEqual({ realmMajor: 1, realmSub: 1 });
  });

  it('rolls over to the next realm major at Đại Viên Mãn (substage 3)', () => {
    expect(nextStage(1, 3)).toEqual({ realmMajor: 2, realmSub: 0 });
  });
});

describe('isMaxStage', () => {
  it('is true only at the max realm major and substage 3', () => {
    expect(isMaxStage(11, 3, 11)).toBe(true);
  });

  it('is false at the max realm major but an earlier substage', () => {
    expect(isMaxStage(11, 2, 11)).toBe(false);
  });

  it('is false below the max realm major', () => {
    expect(isMaxStage(10, 3, 11)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/breakthrough.calc.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 3: Create `backend/src/domain/breakthrough/breakthrough.calc.ts`**

```ts
// Pity formula: each consecutive failure at the current substage raises the
// next attempt's success rate, capped at maxSuccessRate, so a run of bad luck
// is self-correcting instead of indefinitely punishing.
export function computeSuccessRate(params: {
  baseSuccessRate: number;
  pityIncrement: number;
  maxSuccessRate: number;
  breakthroughFails: number;
}): number {
  const raw = params.baseSuccessRate + params.breakthroughFails * params.pityIncrement;
  return Math.min(raw, params.maxSuccessRate);
}

// randomValue is injected (not Math.random() called here) so this function
// stays pure and the caller controls determinism in tests.
export function rollSuccess(successRatePercent: number, randomValue: number): boolean {
  return randomValue * 100 < successRatePercent;
}

// A breakthrough always advances exactly one substage; crossing Đại Viên Mãn
// (substage 3) rolls over into the next realm major at substage 0 (Sơ).
export function nextStage(realmMajor: number, realmSub: number): { realmMajor: number; realmSub: number } {
  if (realmSub < 3) {
    return { realmMajor, realmSub: realmSub + 1 };
  }
  return { realmMajor: realmMajor + 1, realmSub: 0 };
}

export function isMaxStage(realmMajor: number, realmSub: number, maxRealmMajor: number): boolean {
  return realmMajor === maxRealmMajor && realmSub === 3;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/breakthrough.calc.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Update CLAUDE.md**

Append: "Task 5: added breakthrough pity formula and stage-transition logic (`src/domain/breakthrough/breakthrough.calc.ts`), pure and framework-free."

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/breakthrough/breakthrough.calc.ts backend/tests/unit/breakthrough.calc.test.ts CLAUDE.md
git commit -m "feat: add breakthrough pity formula and stage transition logic"
```

---

### Task 6: Domain — entities, ports, and DomainError

**Files:**
- Create: `backend/src/domain/entities/User.ts`
- Create: `backend/src/domain/entities/Character.ts`
- Create: `backend/src/domain/errors.ts`
- Create: `backend/src/domain/ports/UserRepository.ts`
- Create: `backend/src/domain/ports/CharacterRepository.ts`
- Create: `backend/src/domain/ports/PasswordHasher.ts`
- Create: `backend/src/domain/ports/TokenService.ts`
- Create: `backend/src/domain/ports/RandomSource.ts`
- Test: `backend/tests/unit/errors.test.ts`

**Interfaces:**
- Consumes: nothing (pure type/interface declarations plus the small `DomainError` class).
- Produces: `UserRecord`, `CharacterRecord` entity types; `DomainError` class; `UserRepository`, `CharacterRepository` (with `CharacterUpdateInput`), `PasswordHasher`, `TokenService`, `RandomSource` port interfaces — all consumed by Task 7, 8, 9 (application use cases) and Task 10, 11 (infrastructure implementations).

- [ ] **Step 1: Create `backend/src/domain/entities/User.ts`**

```ts
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}
```

- [ ] **Step 2: Create `backend/src/domain/entities/Character.ts`**

```ts
export interface CharacterRecord {
  id: string;
  userId: string;
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
  createdAt: Date;
}
```

- [ ] **Step 3: Write the failing test for `DomainError`**

Create `backend/tests/unit/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DomainError } from '../../src/domain/errors';

describe('DomainError', () => {
  it('is an Error carrying a machine-readable code', () => {
    const err = new DomainError('USERNAME_TAKEN', 'Username already exists');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('USERNAME_TAKEN');
    expect(err.message).toBe('Username already exists');
    expect(err.name).toBe('DomainError');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/errors.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 5: Create `backend/src/domain/errors.ts`**

```ts
// Deliberately has no HTTP status: status codes are an HTTP/presentation
// concept. presentation/middleware/errorHandler.ts maps `code` to a status,
// keeping domain/application free of any HTTP-layer knowledge.
export class DomainError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/errors.test.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Create `backend/src/domain/ports/UserRepository.ts`**

```ts
import { UserRecord } from '../entities/User';

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  create(input: { username: string; passwordHash: string }): Promise<UserRecord>;
}
```

(`create` also creates the character row's default state, per spec section 7 — an implementation detail of the Prisma adapter in Task 11, not something the port signature needs to expose.)

- [ ] **Step 8: Create `backend/src/domain/ports/CharacterRepository.ts`**

```ts
import { CharacterRecord } from '../entities/Character';

export interface CharacterUpdateInput {
  realmMajor: number;
  realmSub: number;
  linhKhi: number;
  lastUpdateAt: Date;
  breakthroughFails: number;
  punishedUntil: Date | null;
}

export interface CharacterRepository {
  findByUserId(userId: string): Promise<CharacterRecord | null>;

  /**
   * Updates a Character row only if its lastUpdateAt still equals
   * expectedLastUpdateAt (optimistic concurrency guard). Returns the updated
   * record on success, or null if no row matched — meaning another request
   * already wrote to this character first.
   */
  updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null>;
}
```

- [ ] **Step 9: Create `backend/src/domain/ports/PasswordHasher.ts`**

```ts
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}
```

- [ ] **Step 10: Create `backend/src/domain/ports/TokenService.ts`**

```ts
export interface TokenService {
  signAccessToken(userId: string): string;
  verifyAccessToken(token: string): { userId: string };
}
```

- [ ] **Step 11: Create `backend/src/domain/ports/RandomSource.ts`**

```ts
export interface RandomSource {
  /** Returns a float in [0, 1), same contract as Math.random(). Injected so
   * breakthrough rolls are deterministic and testable. */
  next(): number;
}
```

- [ ] **Step 12: Update CLAUDE.md**

Append: "Task 6: added domain entities (`User`, `Character`), `DomainError`, and ports (`UserRepository`, `CharacterRepository`, `PasswordHasher`, `TokenService`, `RandomSource`) under `src/domain/`."

- [ ] **Step 13: Commit**

```bash
git add backend/src/domain/entities backend/src/domain/errors.ts backend/src/domain/ports backend/tests/unit/errors.test.ts CLAUDE.md
git commit -m "feat: add domain entities, DomainError, and repository/service ports"
```

---

### Task 7: Application — RegisterUserUseCase & LoginUserUseCase

**Files:**
- Create: `backend/src/application/RegisterUserUseCase.ts`
- Create: `backend/src/application/LoginUserUseCase.ts`
- Create: `backend/tests/fakes/InMemoryUserRepository.ts`
- Create: `backend/tests/fakes/FakePasswordHasher.ts`
- Create: `backend/tests/fakes/FakeTokenService.ts`
- Test: `backend/tests/unit/RegisterUserUseCase.test.ts`
- Test: `backend/tests/unit/LoginUserUseCase.test.ts`

**Interfaces:**
- Consumes: `UserRepository`, `PasswordHasher`, `TokenService` ports and `DomainError` (Task 6).
- Produces: `RegisterUserUseCase` (`execute(input: { username: string; password: string }): Promise<{ id: string; username: string }>`), `LoginUserUseCase` (`execute(input: { username: string; password: string }): Promise<{ token: string }>`) — consumed by Task 13's auth routes/composition root. Produces fakes `InMemoryUserRepository`, `FakePasswordHasher`, `FakeTokenService` — reused by Task 8 and Task 9's unit tests (fakes only, not `InMemoryUserRepository` which is auth-specific).

This task proves the value of the port/adapter split: the use cases are fully unit-tested here with zero database or real bcrypt/JWT — no infrastructure exists yet at this point in the plan.

- [ ] **Step 1: Create the fakes**

Create `backend/tests/fakes/InMemoryUserRepository.ts`:

```ts
import { UserRepository } from '../../src/domain/ports/UserRepository';
import { UserRecord } from '../../src/domain/entities/User';

export class InMemoryUserRepository implements UserRepository {
  private usersById = new Map<string, UserRecord>();
  private nextId = 1;

  async findByUsername(username: string): Promise<UserRecord | null> {
    for (const user of this.usersById.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `user-${this.nextId++}`,
      username: input.username,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };
    this.usersById.set(user.id, user);
    return user;
  }
}
```

Create `backend/tests/fakes/FakePasswordHasher.ts`:

```ts
import { PasswordHasher } from '../../src/domain/ports/PasswordHasher';

// Deterministic, non-cryptographic stand-in for BcryptPasswordHasher (Task 10) —
// keeps use-case unit tests fast and independent of real hashing cost.
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hashed:${password}`;
  }
}
```

Create `backend/tests/fakes/FakeTokenService.ts`:

```ts
import { TokenService } from '../../src/domain/ports/TokenService';

export class FakeTokenService implements TokenService {
  signAccessToken(userId: string): string {
    return `token-for-${userId}`;
  }

  verifyAccessToken(token: string): { userId: string } {
    const userId = token.replace('token-for-', '');
    if (`token-for-${userId}` !== token) {
      throw new Error('invalid token');
    }
    return { userId };
  }
}
```

- [ ] **Step 2: Write the failing test for `RegisterUserUseCase`**

Create `backend/tests/unit/RegisterUserUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';

describe('RegisterUserUseCase', () => {
  it('creates a user and returns id + username', async () => {
    const useCase = new RegisterUserUseCase(new InMemoryUserRepository(), new FakePasswordHasher());
    const result = await useCase.execute({ username: 'alice', password: 'password123' });
    expect(result.username).toBe('alice');
    expect(typeof result.id).toBe('string');
  });

  it('rejects a duplicate username with USERNAME_TAKEN', async () => {
    const users = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(users, new FakePasswordHasher());
    await useCase.execute({ username: 'bob', password: 'password123' });

    await expect(useCase.execute({ username: 'bob', password: 'password456' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/RegisterUserUseCase.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 4: Create `backend/src/application/RegisterUserUseCase.ts`**

```ts
import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { DomainError } from '../domain/errors';

export interface RegisterUserInput {
  username: string;
  password: string;
}

export interface RegisterUserOutput {
  id: string;
  username: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.users.findByUsername(input.username);
    if (existing) {
      throw new DomainError('USERNAME_TAKEN', 'Username already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({ username: input.username, passwordHash });

    return { id: user.id, username: user.username };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/RegisterUserUseCase.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `LoginUserUseCase`**

Create `backend/tests/unit/LoginUserUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../src/application/LoginUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('LoginUserUseCase', () => {
  it('returns a token for valid credentials', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    await new RegisterUserUseCase(users, passwordHasher).execute({ username: 'dave', password: 'password123' });

    const useCase = new LoginUserUseCase(users, passwordHasher, new FakeTokenService());
    const result = await useCase.execute({ username: 'dave', password: 'password123' });
    expect(result.token).toBe('token-for-user-1');
  });

  it('rejects an unknown username with INVALID_CREDENTIALS', async () => {
    const useCase = new LoginUserUseCase(new InMemoryUserRepository(), new FakePasswordHasher(), new FakeTokenService());
    await expect(useCase.execute({ username: 'nobody', password: 'whatever1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    await new RegisterUserUseCase(users, passwordHasher).execute({ username: 'erin', password: 'password123' });

    const useCase = new LoginUserUseCase(users, passwordHasher, new FakeTokenService());
    await expect(useCase.execute({ username: 'erin', password: 'wrongpass1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/LoginUserUseCase.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 8: Create `backend/src/application/LoginUserUseCase.ts`**

```ts
import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface LoginUserInput {
  username: string;
  password: string;
}

export interface LoginUserOutput {
  token: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const user = await this.users.findByUsername(input.username);
    if (!user) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid username or password');
    }

    const valid = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid username or password');
    }

    const token = this.tokenService.signAccessToken(user.id);
    return { token };
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/LoginUserUseCase.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 10: Update CLAUDE.md**

Append: "Task 7: added `RegisterUserUseCase`/`LoginUserUseCase` (`src/application/`), unit-tested against in-memory fakes (`tests/fakes/`) with no database or real crypto involved."

- [ ] **Step 11: Commit**

```bash
git add backend/src/application/RegisterUserUseCase.ts backend/src/application/LoginUserUseCase.ts backend/tests/fakes backend/tests/unit/RegisterUserUseCase.test.ts backend/tests/unit/LoginUserUseCase.test.ts CLAUDE.md
git commit -m "feat: add RegisterUserUseCase and LoginUserUseCase"
```

---

### Task 8: Application — GetCultivationStateUseCase

**Files:**
- Create: `backend/src/application/GetCultivationStateUseCase.ts`
- Create: `backend/tests/fakes/InMemoryCharacterRepository.ts`
- Test: `backend/tests/unit/GetCultivationStateUseCase.test.ts`

**Interfaces:**
- Consumes: `CharacterRepository` port (Task 6), `REALMS`/`MAX_REALM_MAJOR` (Task 3), `computeLinhKhi` (Task 4), `isMaxStage` (Task 5), `DomainError` (Task 6).
- Produces: `GetCultivationStateUseCase` (`execute(userId: string): Promise<CultivationStateOutput>` where `CultivationStateOutput = { realmMajor, realmSub, realmName, linhKhi, linhKhiRequired, canBreakthrough, isMaxStage, punishedUntil, cultivationRate }`) — consumed by Task 14's cultivation routes. Produces fake `InMemoryCharacterRepository` — reused by Task 9.

- [ ] **Step 1: Create `backend/tests/fakes/InMemoryCharacterRepository.ts`**

```ts
import { CharacterRepository, CharacterUpdateInput } from '../../src/domain/ports/CharacterRepository';
import { CharacterRecord } from '../../src/domain/entities/Character';

export class InMemoryCharacterRepository implements CharacterRepository {
  private charactersById = new Map<string, CharacterRecord>();

  /** Test helper — not part of the port — to seed a character directly. */
  seed(character: CharacterRecord): void {
    this.charactersById.set(character.id, character);
  }

  async findByUserId(userId: string): Promise<CharacterRecord | null> {
    for (const character of this.charactersById.values()) {
      if (character.userId === userId) return character;
    }
    return null;
  }

  async updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null> {
    const existing = this.charactersById.get(id);
    if (!existing || existing.lastUpdateAt.getTime() !== expectedLastUpdateAt.getTime()) {
      return null;
    }
    const updated: CharacterRecord = { ...existing, ...data };
    this.charactersById.set(id, updated);
    return updated;
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/unit/GetCultivationStateUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GetCultivationStateUseCase } from '../../src/application/GetCultivationStateUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { CharacterRecord } from '../../src/domain/entities/Character';

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1',
    userId: 'user-1',
    realmMajor: 0,
    realmSub: 0,
    linhKhi: 0,
    lastUpdateAt: new Date(),
    breakthroughFails: 0,
    punishedUntil: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('GetCultivationStateUseCase', () => {
  it('rejects an unknown user with CHARACTER_NOT_FOUND', async () => {
    const useCase = new GetCultivationStateUseCase(new InMemoryCharacterRepository());
    await expect(useCase.execute('nobody')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('reports canBreakthrough=false and isMaxStage=false for a fresh Phàm Nhân - Sơ character', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter());
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.realmName).toBe('Phàm Nhân - Sơ');
    expect(result.linhKhiRequired).toBe(100);
    expect(result.canBreakthrough).toBe(false);
    expect(result.isMaxStage).toBe(false);
  });

  it('reports canBreakthrough=true once accrued linh khi reaches the requirement', async () => {
    const characters = new InMemoryCharacterRepository();
    const lastUpdateAt = new Date(Date.now() - 200_000); // 200s ago, rate 1.0/s => +200
    characters.seed(makeCharacter({ linhKhi: 0, lastUpdateAt }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.linhKhi).toBeGreaterThanOrEqual(100);
    expect(result.canBreakthrough).toBe(true);
  });

  it('reports canBreakthrough=false while punishedUntil is in the future, even with enough linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 500, punishedUntil: new Date(Date.now() + 60_000) }));
    const result = await new GetCultivationStateUseCase(characters).execute('user-1');

    expect(result.canBreakthrough).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/GetCultivationStateUseCase.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 4: Create `backend/src/application/GetCultivationStateUseCase.ts`**

```ts
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../infrastructure/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { isMaxStage } from '../domain/breakthrough/breakthrough.calc';

export interface CultivationStateOutput {
  realmMajor: number;
  realmSub: number;
  realmName: string;
  linhKhi: number;
  linhKhiRequired: number;
  canBreakthrough: boolean;
  isMaxStage: boolean;
  punishedUntil: Date | null;
  cultivationRate: number;
}

export class GetCultivationStateUseCase {
  constructor(private readonly characters: CharacterRepository) {}

  async execute(userId: string): Promise<CultivationStateOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
    const now = new Date();
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
    });

    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();
    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);

    return {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      realmName: `${REALMS[character.realmMajor].name} - ${stage.name}`,
      linhKhi: currentLinhKhi,
      linhKhiRequired: stage.linhKhiRequired,
      // This is a read path: it never persists, so `canBreakthrough` only informs
      // the client UI — POST /cultivation/breakthrough re-validates everything itself.
      canBreakthrough: !atMax && !punished && currentLinhKhi >= stage.linhKhiRequired,
      isMaxStage: atMax,
      punishedUntil: character.punishedUntil,
      cultivationRate: stage.cultivationRate,
    };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/GetCultivationStateUseCase.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Update CLAUDE.md**

Append: "Task 8: added `GetCultivationStateUseCase` (`src/application/`), unit-tested against `InMemoryCharacterRepository` fake — no database needed."

- [ ] **Step 7: Commit**

```bash
git add backend/src/application/GetCultivationStateUseCase.ts backend/tests/fakes/InMemoryCharacterRepository.ts backend/tests/unit/GetCultivationStateUseCase.test.ts CLAUDE.md
git commit -m "feat: add GetCultivationStateUseCase"
```

---

### Task 9: Application — AttemptBreakthroughUseCase

**Files:**
- Create: `backend/src/application/AttemptBreakthroughUseCase.ts`
- Create: `backend/tests/fakes/FixedRandomSource.ts`
- Test: `backend/tests/unit/AttemptBreakthroughUseCase.test.ts`

**Interfaces:**
- Consumes: `CharacterRepository`, `RandomSource` ports (Task 6), `REALMS`/`MAX_REALM_MAJOR` (Task 3), `computeLinhKhi` (Task 4), `computeSuccessRate`/`rollSuccess`/`nextStage`/`isMaxStage` (Task 5), `DomainError` (Task 6), `InMemoryCharacterRepository` (Task 8).
- Produces: `AttemptBreakthroughUseCase` (`execute(userId: string): Promise<{ success: boolean; character: CharacterRecord }>`) — consumed by Task 14's cultivation routes. Produces fake `FixedRandomSource`.

- [ ] **Step 1: Create `backend/tests/fakes/FixedRandomSource.ts`**

```ts
import { RandomSource } from '../../src/domain/ports/RandomSource';

export class FixedRandomSource implements RandomSource {
  constructor(private readonly value: number) {}

  next(): number {
    return this.value;
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/unit/AttemptBreakthroughUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { AttemptBreakthroughUseCase } from '../../src/application/AttemptBreakthroughUseCase';
import { InMemoryCharacterRepository } from '../fakes/InMemoryCharacterRepository';
import { FixedRandomSource } from '../fakes/FixedRandomSource';
import { CharacterRecord } from '../../src/domain/entities/Character';

function makeCharacter(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: 'char-1',
    userId: 'user-1',
    realmMajor: 0,
    realmSub: 0,
    linhKhi: 0,
    lastUpdateAt: new Date(),
    breakthroughFails: 0,
    punishedUntil: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AttemptBreakthroughUseCase', () => {
  it('rejects an unknown user with CHARACTER_NOT_FOUND', async () => {
    const useCase = new AttemptBreakthroughUseCase(new InMemoryCharacterRepository(), new FixedRandomSource(0));
    await expect(useCase.execute('nobody')).rejects.toMatchObject({ code: 'CHARACTER_NOT_FOUND' });
  });

  it('rejects with INSUFFICIENT_LINH_KHI when below the requirement, but still persists accrued linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 10 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_KHI' });

    const state = await characters.findByUserId('user-1');
    expect(state?.linhKhi).toBe(10); // unchanged: no time elapsed since lastUpdateAt in this test
  });

  it('rejects with PUNISHED while punishedUntil is in the future', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 500, punishedUntil: new Date(Date.now() + 60_000) }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'PUNISHED' });
  });

  it('rejects with MAX_STAGE_REACHED at Thái Ất - Đại Viên Mãn', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ realmMajor: 11, realmSub: 3, linhKhi: 999_999_999 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'MAX_STAGE_REACHED' });
  });

  it('advances the substage, carries over excess linh khi, and resets fails on success', async () => {
    const characters = new InMemoryCharacterRepository();
    // Phàm Nhân - Sơ requires 100 linh khi; seed exactly 150 so 50 carries over.
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughFails: 2 }));
    // randomValue 0 always beats any positive success rate (rollSuccess: randomValue*100 < rate).
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    const result = await useCase.execute('user-1');

    expect(result.success).toBe(true);
    expect(result.character.realmMajor).toBe(0);
    expect(result.character.realmSub).toBe(1);
    expect(result.character.linhKhi).toBe(50);
    expect(result.character.breakthroughFails).toBe(0);
    expect(result.character.punishedUntil).toBeNull();
  });

  it('sets punishedUntil and increments breakthroughFails on failure, without deducting linh khi', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150, breakthroughFails: 0 }));
    // randomValue 0.999 beats no realistic success rate (< 99.9%), forcing failure.
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0.999));

    const result = await useCase.execute('user-1');

    expect(result.success).toBe(false);
    expect(result.character.realmMajor).toBe(0);
    expect(result.character.realmSub).toBe(0);
    expect(result.character.linhKhi).toBe(150);
    expect(result.character.breakthroughFails).toBe(1);
    expect(result.character.punishedUntil).not.toBeNull();
  });

  it('rolls over realmMajor when breaking through from Đại Viên Mãn (substage 3)', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ realmMajor: 0, realmSub: 3, linhKhi: 500 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    const result = await useCase.execute('user-1');

    expect(result.character.realmMajor).toBe(1);
    expect(result.character.realmSub).toBe(0);
  });

  it('throws CONCURRENT_MODIFICATION if the character was modified between read and write', async () => {
    const characters = new InMemoryCharacterRepository();
    characters.seed(makeCharacter({ linhKhi: 150 }));
    const useCase = new AttemptBreakthroughUseCase(characters, new FixedRandomSource(0));

    // Simulate another request winning the race by changing lastUpdateAt first.
    const original = await characters.findByUserId('user-1');
    await characters.updateWithConcurrencyGuard(original!.id, original!.lastUpdateAt, {
      ...original!,
      lastUpdateAt: new Date(original!.lastUpdateAt.getTime() + 1),
    });

    await expect(useCase.execute('user-1')).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/AttemptBreakthroughUseCase.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 4: Create `backend/src/application/AttemptBreakthroughUseCase.ts`**

```ts
import { CharacterRepository } from '../domain/ports/CharacterRepository';
import { RandomSource } from '../domain/ports/RandomSource';
import { DomainError } from '../domain/errors';
import { REALMS, MAX_REALM_MAJOR } from '../infrastructure/config/realms';
import { computeLinhKhi } from '../domain/cultivation/cultivation.calc';
import { computeSuccessRate, rollSuccess, nextStage, isMaxStage } from '../domain/breakthrough/breakthrough.calc';
import { CharacterRecord } from '../domain/entities/Character';

export interface AttemptBreakthroughOutput {
  success: boolean;
  character: CharacterRecord;
}

export class AttemptBreakthroughUseCase {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly randomSource: RandomSource,
  ) {}

  async execute(userId: string): Promise<AttemptBreakthroughOutput> {
    const character = await this.characters.findByUserId(userId);
    if (!character) {
      throw new DomainError('CHARACTER_NOT_FOUND', 'Character not found');
    }

    const stage = REALMS[character.realmMajor].subStages[character.realmSub];
    const now = new Date();
    // Recompute lazily-accrued linh khi once, up front. Every branch below
    // (including the three rejection paths) persists this value as its first
    // write, so a rejected attempt never silently drops accrued progress.
    const currentLinhKhi = computeLinhKhi({
      storedLinhKhi: character.linhKhi,
      lastUpdateAt: character.lastUpdateAt,
      now,
      cultivationRate: stage.cultivationRate,
    });

    const atMax = isMaxStage(character.realmMajor, character.realmSub, MAX_REALM_MAJOR);
    const punished = character.punishedUntil !== null && character.punishedUntil.getTime() > now.getTime();

    if (atMax) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('MAX_STAGE_REACHED', 'Already at the maximum realm and substage');
    }

    if (punished) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('PUNISHED', 'Currently punished after a failed breakthrough');
    }

    if (currentLinhKhi < stage.linhKhiRequired) {
      await this.persist(character, currentLinhKhi, now, {
        realmMajor: character.realmMajor,
        realmSub: character.realmSub,
        breakthroughFails: character.breakthroughFails,
        punishedUntil: character.punishedUntil,
      });
      throw new DomainError('INSUFFICIENT_LINH_KHI', 'Not enough linh khi to attempt a breakthrough');
    }

    const successRate = computeSuccessRate({
      baseSuccessRate: stage.baseSuccessRate,
      pityIncrement: stage.pityIncrement,
      maxSuccessRate: stage.maxSuccessRate,
      breakthroughFails: character.breakthroughFails,
    });
    const succeeded = rollSuccess(successRate, this.randomSource.next());

    if (succeeded) {
      const { realmMajor, realmSub } = nextStage(character.realmMajor, character.realmSub);
      const updated = await this.persist(character, currentLinhKhi - stage.linhKhiRequired, now, {
        realmMajor,
        realmSub,
        breakthroughFails: 0,
        punishedUntil: null,
      });
      return { success: true, character: updated };
    }

    const updated = await this.persist(character, currentLinhKhi, now, {
      realmMajor: character.realmMajor,
      realmSub: character.realmSub,
      breakthroughFails: character.breakthroughFails + 1,
      punishedUntil: new Date(now.getTime() + stage.punishmentSeconds * 1000),
    });
    return { success: false, character: updated };
  }

  private async persist(
    original: CharacterRecord,
    linhKhi: number,
    lastUpdateAt: Date,
    rest: { realmMajor: number; realmSub: number; breakthroughFails: number; punishedUntil: Date | null },
  ): Promise<CharacterRecord> {
    // Scoped to the lastUpdateAt read at the top of execute(): if another
    // request already wrote to this character first, lastUpdateAt on the row
    // no longer matches and the guard returns null — preventing two
    // concurrent breakthrough attempts from double-advancing one character.
    const updated = await this.characters.updateWithConcurrencyGuard(original.id, original.lastUpdateAt, {
      linhKhi,
      lastUpdateAt,
      ...rest,
    });
    if (!updated) {
      throw new DomainError('CONCURRENT_MODIFICATION', 'Character was modified by another request');
    }
    return updated;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/AttemptBreakthroughUseCase.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Update CLAUDE.md**

Append: "Task 9: added `AttemptBreakthroughUseCase` (`src/application/`) with the optimistic-concurrency guard, unit-tested against `InMemoryCharacterRepository` and `FixedRandomSource` fakes — deterministic success/failure without any real RNG or database."

- [ ] **Step 7: Commit**

```bash
git add backend/src/application/AttemptBreakthroughUseCase.ts backend/tests/fakes/FixedRandomSource.ts backend/tests/unit/AttemptBreakthroughUseCase.test.ts CLAUDE.md
git commit -m "feat: add AttemptBreakthroughUseCase with optimistic concurrency guard"
```

---

### Task 10: Infrastructure — BcryptPasswordHasher, JwtTokenService, MathRandomSource

**Files:**
- Create: `backend/src/infrastructure/auth/BcryptPasswordHasher.ts`
- Create: `backend/src/infrastructure/auth/JwtTokenService.ts`
- Create: `backend/src/infrastructure/random/MathRandomSource.ts`
- Test: `backend/tests/unit/BcryptPasswordHasher.test.ts`
- Test: `backend/tests/unit/JwtTokenService.test.ts`

**Interfaces:**
- Consumes: `PasswordHasher`, `TokenService`, `RandomSource` ports (Task 6).
- Produces: `BcryptPasswordHasher implements PasswordHasher`, `JwtTokenService implements TokenService` (constructor takes `secret: string`), `MathRandomSource implements RandomSource` — all consumed by Task 13/14's composition root wiring in `app.ts`.

Before writing this task's code, check current docs for `bcrypt` ^5.1.1 and `jsonwebtoken` ^9.0.2 via `ctx7` to confirm the async `hash`/`compare` and `sign`/`verify` signatures match what's used below.

- [ ] **Step 1: Write the failing test for `BcryptPasswordHasher`**

Create `backend/tests/unit/BcryptPasswordHasher.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BcryptPasswordHasher } from '../../src/infrastructure/auth/BcryptPasswordHasher';

describe('BcryptPasswordHasher', () => {
  it('hashes a password and verifies it back with compare', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('password123');
    expect(hash).not.toBe('password123');
    expect(await hasher.compare('password123', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hasher = new BcryptPasswordHasher();
    const hash = await hasher.hash('password123');
    expect(await hasher.compare('wrongpass', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/BcryptPasswordHasher.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 3: Create `backend/src/infrastructure/auth/BcryptPasswordHasher.ts`**

```ts
import bcrypt from 'bcrypt';
import { PasswordHasher } from '../../domain/ports/PasswordHasher';

const SALT_ROUNDS = 10;

export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/BcryptPasswordHasher.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for `JwtTokenService`**

Create `backend/tests/unit/JwtTokenService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { JwtTokenService } from '../../src/infrastructure/auth/JwtTokenService';

describe('JwtTokenService', () => {
  it('signs a token that verifies back to the same userId', () => {
    const service = new JwtTokenService('test-secret');
    const token = service.signAccessToken('user-123');
    expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123' });
  });

  it('throws when verifying a token signed with a different secret', () => {
    const signer = new JwtTokenService('secret-a');
    const verifier = new JwtTokenService('secret-b');
    const token = signer.signAccessToken('user-123');
    expect(() => verifier.verifyAccessToken(token)).toThrow();
  });

  it('throws when verifying garbage input', () => {
    const service = new JwtTokenService('test-secret');
    expect(() => service.verifyAccessToken('not-a-real-token')).toThrow();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/JwtTokenService.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 7: Create `backend/src/infrastructure/auth/JwtTokenService.ts`**

```ts
import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {}

  signAccessToken(userId: string): string {
    return jwt.sign({ userId }, this.secret, { expiresIn: '7d' });
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.secret);
    return payload as { userId: string };
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/JwtTokenService.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Create `backend/src/infrastructure/random/MathRandomSource.ts`** (no dedicated test — it's a one-line pass-through to `Math.random()`, exercised indirectly wherever it's wired in Task 14)

```ts
import { RandomSource } from '../../domain/ports/RandomSource';

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}
```

- [ ] **Step 10: Update CLAUDE.md**

Append: "Task 10: added infrastructure adapters `BcryptPasswordHasher`, `JwtTokenService` (`src/infrastructure/auth/`), and `MathRandomSource` (`src/infrastructure/random/`), each implementing a domain port from Task 6."

- [ ] **Step 11: Commit**

```bash
git add backend/src/infrastructure/auth backend/src/infrastructure/random backend/tests/unit/BcryptPasswordHasher.test.ts backend/tests/unit/JwtTokenService.test.ts CLAUDE.md
git commit -m "feat: add bcrypt, JWT, and random-source infrastructure adapters"
```

---

### Task 11: Infrastructure — Prisma repositories (User & Character)

**Files:**
- Create: `backend/src/infrastructure/repositories/PrismaUserRepository.ts`
- Create: `backend/src/infrastructure/repositories/PrismaCharacterRepository.ts`
- Test: `backend/tests/integration/PrismaUserRepository.test.ts`
- Test: `backend/tests/integration/PrismaCharacterRepository.test.ts`

**Interfaces:**
- Consumes: `UserRepository`, `CharacterRepository` ports (Task 6), `prisma` client singleton (Task 2).
- Produces: `PrismaUserRepository implements UserRepository`, `PrismaCharacterRepository implements CharacterRepository` (both take a `PrismaClient` in their constructor) — consumed by Task 13/14's composition root wiring in `app.ts`.

Before writing this task's code, check current docs for `@prisma/client` ^5.20.0 via `ctx7` to confirm the `updateMany` return shape (`{ count: number }`) and `findUniqueOrThrow` behavior used below.

- [ ] **Step 1: Ensure the dev database is running**

Run: `cd backend && docker compose up -d db`

- [ ] **Step 2: Write the failing test for `PrismaUserRepository`**

Create `backend/tests/integration/PrismaUserRepository.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaUserRepository } from '../../src/infrastructure/repositories/PrismaUserRepository';

const repository = new PrismaUserRepository(prisma);

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaUserRepository', () => {
  it('creates a user with a default character and finds it by username', async () => {
    const created = await repository.create({ username: 'alice', passwordHash: 'hashed' });
    expect(created.username).toBe('alice');

    const found = await repository.findByUsername('alice');
    expect(found?.id).toBe(created.id);

    const character = await prisma.character.findUnique({ where: { userId: created.id } });
    expect(character?.realmMajor).toBe(0);
    expect(character?.realmSub).toBe(0);
    expect(character?.linhKhi).toBe(0);
  });

  it('returns null for an unknown username', async () => {
    expect(await repository.findByUsername('nobody')).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/integration/PrismaUserRepository.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 4: Create `backend/src/infrastructure/repositories/PrismaUserRepository.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../domain/ports/UserRepository';
import { UserRecord } from '../../domain/entities/User';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { username } });
  }

  async create(input: { username: string; passwordHash: string }): Promise<UserRecord> {
    // Nested create makes User + its default Character one atomic write,
    // matching spec section 7 ("register creates User + Character mặc định").
    return this.client.user.create({
      data: {
        username: input.username,
        passwordHash: input.passwordHash,
        character: { create: {} },
      },
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/integration/PrismaUserRepository.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `PrismaCharacterRepository`**

Create `backend/tests/integration/PrismaCharacterRepository.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/infrastructure/db/prisma';
import { PrismaUserRepository } from '../../src/infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from '../../src/infrastructure/repositories/PrismaCharacterRepository';

const users = new PrismaUserRepository(prisma);
const characters = new PrismaCharacterRepository(prisma);

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('PrismaCharacterRepository', () => {
  it('finds a character by userId', async () => {
    const user = await users.create({ username: 'bob', passwordHash: 'hashed' });
    const found = await characters.findByUserId(user.id);
    expect(found?.userId).toBe(user.id);
  });

  it('returns null for a userId with no character', async () => {
    expect(await characters.findByUserId('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('updates the row when expectedLastUpdateAt matches', async () => {
    const user = await users.create({ username: 'carol', passwordHash: 'hashed' });
    const character = await characters.findByUserId(user.id);

    const updated = await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 1,
      linhKhi: 42,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
    });

    expect(updated?.realmSub).toBe(1);
    expect(updated?.linhKhi).toBe(42);
  });

  it('returns null and does not write when expectedLastUpdateAt is stale (concurrent modification)', async () => {
    const user = await users.create({ username: 'dave', passwordHash: 'hashed' });
    const character = await characters.findByUserId(user.id);

    // First writer succeeds.
    await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 1,
      linhKhi: 10,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
    });

    // Second writer still has the stale lastUpdateAt read before the first write.
    const staleResult = await characters.updateWithConcurrencyGuard(character!.id, character!.lastUpdateAt, {
      realmMajor: 0,
      realmSub: 2,
      linhKhi: 999,
      lastUpdateAt: new Date(),
      breakthroughFails: 0,
      punishedUntil: null,
    });

    expect(staleResult).toBeNull();
    const current = await characters.findByUserId(user.id);
    expect(current?.realmSub).toBe(1); // first writer's value stands
    expect(current?.linhKhi).toBe(10);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/integration/PrismaCharacterRepository.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 8: Create `backend/src/infrastructure/repositories/PrismaCharacterRepository.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { CharacterRepository, CharacterUpdateInput } from '../../domain/ports/CharacterRepository';
import { CharacterRecord } from '../../domain/entities/Character';

export class PrismaCharacterRepository implements CharacterRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUserId(userId: string): Promise<CharacterRecord | null> {
    return this.client.character.findUnique({ where: { userId } });
  }

  async updateWithConcurrencyGuard(
    id: string,
    expectedLastUpdateAt: Date,
    data: CharacterUpdateInput,
  ): Promise<CharacterRecord | null> {
    // updateMany scoped to id + the lastUpdateAt read at the top of the caller's
    // request: if another request already wrote first, the row's lastUpdateAt
    // no longer matches expectedLastUpdateAt and count is 0 — no row is touched.
    const result = await this.client.character.updateMany({
      where: { id, lastUpdateAt: expectedLastUpdateAt },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.client.character.findUniqueOrThrow({ where: { id } });
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/integration/PrismaCharacterRepository.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 10: Update CLAUDE.md**

Append: "Task 11: added `PrismaUserRepository`/`PrismaCharacterRepository` (`src/infrastructure/repositories/`), integration-tested against real Postgres. The concurrency guard uses `updateMany({ where: { id, lastUpdateAt } })` + a `count === 0` check."

- [ ] **Step 11: Commit**

```bash
git add backend/src/infrastructure/repositories backend/tests/integration/PrismaUserRepository.test.ts backend/tests/integration/PrismaCharacterRepository.test.ts CLAUDE.md
git commit -m "feat: add Prisma-backed User and Character repositories"
```

---

### Task 12: Presentation — errorHandler and requireAuth middleware

**Files:**
- Create: `backend/src/presentation/middleware/errorHandler.ts`
- Create: `backend/src/presentation/middleware/auth.ts`
- Test: `backend/tests/unit/errorHandler.test.ts`
- Test: `backend/tests/unit/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `DomainError` (Task 6), `TokenService` port (Task 6), `FakeTokenService` (Task 7).
- Produces: `errorHandler` Express error-middleware, `createRequireAuth(tokenService: TokenService)` returning a `requireAuth` middleware, and `interface AuthedRequest extends Request { userId?: string }` — consumed by Task 13's auth routes and Task 14's cultivation routes/composition root.

- [ ] **Step 1: Write the failing test for `errorHandler`**

Create `backend/tests/unit/errorHandler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/presentation/middleware/errorHandler';
import { DomainError } from '../../src/domain/errors';

function buildTestApp() {
  const app = express();
  app.get('/boom-username-taken', () => {
    throw new DomainError('USERNAME_TAKEN', 'Username already exists');
  });
  app.get('/boom-unknown-code', () => {
    throw new DomainError('SOMETHING_NEW', 'Not yet mapped');
  });
  app.get('/boom-unexpected', () => {
    throw new Error('unexpected');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('maps a known DomainError code to its HTTP status', async () => {
    const res = await request(buildTestApp()).get('/boom-username-taken');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'USERNAME_TAKEN', message: 'Username already exists' } });
  });

  it('falls back to 500 for a DomainError code with no status mapping', async () => {
    const res = await request(buildTestApp()).get('/boom-unknown-code');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SOMETHING_NEW');
  });

  it('formats a non-DomainError as a 500 INTERNAL_ERROR', async () => {
    const res = await request(buildTestApp()).get('/boom-unexpected');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/errorHandler.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 3: Create `backend/src/presentation/middleware/errorHandler.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../domain/errors';

// The only place DomainError.code is mapped to an HTTP status — keeps that
// mapping decision out of domain/ and application/ entirely.
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  USERNAME_TAKEN: 409,
  CONCURRENT_MODIFICATION: 409,
  CHARACTER_NOT_FOUND: 404,
  INSUFFICIENT_LINH_KHI: 400,
  PUNISHED: 400,
  MAX_STAGE_REACHED: 400,
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof DomainError) {
    const status = STATUS_BY_CODE[err.code] ?? 500;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/errorHandler.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `requireAuth`**

Create `backend/tests/unit/auth.middleware.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequireAuth, AuthedRequest } from '../../src/presentation/middleware/auth';
import { FakeTokenService } from '../fakes/FakeTokenService';

function buildTestApp() {
  const app = express();
  const requireAuth = createRequireAuth(new FakeTokenService());
  app.get('/protected', requireAuth, (req: AuthedRequest, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('rejects requests with no Authorization header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid token with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid token and attaches userId', async () => {
    const token = new FakeTokenService().signAccessToken('user-123');
    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-123');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/auth.middleware.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 7: Create `backend/src/presentation/middleware/auth.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../domain/ports/TokenService';

export interface AuthedRequest extends Request {
  userId?: string;
}

// Factory, not a bare middleware: depends on the TokenService port (Task 6)
// rather than importing jsonwebtoken directly, so presentation/ stays decoupled
// from which token implementation the composition root wires in.
export function createRequireAuth(tokenService: TokenService) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
      return;
    }

    const token = header.slice('Bearer '.length);
    try {
      // Writes its own 401 response directly (not via next(err)/DomainError):
      // this middleware runs before a route handler's try/catch exists.
      const payload = tokenService.verifyAccessToken(token);
      req.userId = payload.userId;
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/auth.middleware.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Update CLAUDE.md**

Append: "Task 12: added `errorHandler` (maps `DomainError.code` → HTTP status, single source of truth for the `{ error: { code, message } }` shape) and `createRequireAuth(tokenService)` factory middleware, both under `src/presentation/middleware/`."

- [ ] **Step 10: Commit**

```bash
git add backend/src/presentation/middleware backend/tests/unit/errorHandler.test.ts backend/tests/unit/auth.middleware.test.ts CLAUDE.md
git commit -m "feat: add errorHandler and requireAuth presentation middleware"
```

---

### Task 13: Presentation — auth routes, schemas, and composition root wiring

**Files:**
- Create: `backend/src/presentation/schemas/auth.schemas.ts`
- Create: `backend/src/presentation/routes/auth.routes.ts`
- Modify: `backend/src/app.ts` (composition root: wire `PrismaUserRepository`, `BcryptPasswordHasher`, `JwtTokenService`, `RegisterUserUseCase`, `LoginUserUseCase`, mount `/auth`, mount `errorHandler`)
- Test: `backend/tests/integration/auth.routes.test.ts`

**Interfaces:**
- Consumes: `RegisterUserUseCase`, `LoginUserUseCase` (Task 7), `DomainError` (Task 6), `errorHandler` (Task 12), `PrismaUserRepository` (Task 11), `BcryptPasswordHasher`, `JwtTokenService` (Task 10), `prisma` (Task 2).
- Produces: `createAuthRouter(deps: { registerUserUseCase: RegisterUserUseCase; loginUserUseCase: LoginUserUseCase }): Router`, `POST /auth/register` → `201 { id, username }`, `POST /auth/login` → `200 { token }`. Updates `createApp(): express.Express` to include working auth end-to-end.

- [ ] **Step 1: Create `backend/src/presentation/schemas/auth.schemas.ts`**

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 2: Create `backend/src/presentation/routes/auth.routes.ts`**

```ts
import { Router } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';
import { RegisterUserUseCase } from '../../application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/LoginUserUseCase';
import { DomainError } from '../../domain/errors';

export interface AuthRouterDeps {
  registerUserUseCase: RegisterUserUseCase;
  loginUserUseCase: LoginUserUseCase;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', parsed.error.issues[0].message);
      }
      const result = await deps.registerUserUseCase.execute(parsed.data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new DomainError('INVALID_INPUT', parsed.error.issues[0].message);
      }
      const result = await deps.loginUserUseCase.execute(parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 3: Replace `backend/src/app.ts` with the composition root wiring auth end-to-end**

```ts
import express from 'express';
import { prisma } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { errorHandler } from './presentation/middleware/errorHandler';

export function createApp() {
  const userRepository = new PrismaUserRepository(prisma);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(process.env.JWT_SECRET as string);

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter({ registerUserUseCase, loginUserUseCase }));

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Write the failing integration test**

Create `backend/tests/integration/auth.routes.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('creates a user and a default character', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alice');

    const character = await prisma.character.findFirst({ where: { user: { username: 'alice' } } });
    expect(character).not.toBeNull();
    expect(character?.realmMajor).toBe(0);
  });

  it('rejects duplicate usernames with 409', async () => {
    await request(app).post('/auth/register').send({ username: 'bob', password: 'password123' });
    const res = await request(app).post('/auth/register').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects passwords shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'carol', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT for valid credentials', async () => {
    await request(app).post('/auth/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'dave', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/auth/register').send({ username: 'erin', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'erin', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Ensure the dev database is up: `cd backend && docker compose up -d db`
Run: `cd backend && npm test -- tests/integration/auth.routes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Update CLAUDE.md**

Append: "Task 13: wired `POST /auth/register` and `POST /auth/login` end-to-end through the composition root (`src/app.ts`), integration-tested against real Postgres."

- [ ] **Step 7: Commit**

```bash
git add backend/src/presentation/schemas backend/src/presentation/routes/auth.routes.ts backend/src/app.ts backend/tests/integration/auth.routes.test.ts CLAUDE.md
git commit -m "feat: wire register and login endpoints end-to-end"
```

---

### Task 14: Presentation — cultivation routes, wired end-to-end

**Files:**
- Create: `backend/src/presentation/routes/cultivation.routes.ts`
- Modify: `backend/src/app.ts` (composition root: add `PrismaCharacterRepository`, `MathRandomSource`, `GetCultivationStateUseCase`, `AttemptBreakthroughUseCase`, `createRequireAuth(tokenService)`, mount `/cultivation`; add an optional `randomSource` override parameter so tests can force success/failure deterministically)
- Test: `backend/tests/integration/cultivation.state.test.ts`
- Test: `backend/tests/integration/cultivation.breakthrough.test.ts`

**Interfaces:**
- Consumes: `GetCultivationStateUseCase` (Task 8), `AttemptBreakthroughUseCase` (Task 9), `PrismaCharacterRepository` (Task 11), `MathRandomSource` (Task 10), `createRequireAuth`/`AuthedRequest` (Task 12), `RandomSource` port (Task 6).
- Produces: `createCultivationRouter(deps: { getCultivationStateUseCase; attemptBreakthroughUseCase; requireAuth }): Router`, `GET /cultivation/state`, `POST /cultivation/breakthrough`. Updates `createApp(overrides?: { randomSource?: RandomSource }): express.Express` — the final shape of the composition root for Phase 1.

- [ ] **Step 1: Create `backend/src/presentation/routes/cultivation.routes.ts`**

```ts
import { Router, RequestHandler } from 'express';
import { GetCultivationStateUseCase } from '../../application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from '../../application/AttemptBreakthroughUseCase';
import { AuthedRequest } from '../middleware/auth';

export interface CultivationRouterDeps {
  getCultivationStateUseCase: GetCultivationStateUseCase;
  attemptBreakthroughUseCase: AttemptBreakthroughUseCase;
  requireAuth: RequestHandler;
}

export function createCultivationRouter(deps: CultivationRouterDeps): Router {
  const router = Router();

  router.get('/state', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const state = await deps.getCultivationStateUseCase.execute(req.userId as string);
      res.status(200).json(state);
    } catch (err) {
      next(err);
    }
  });

  router.post('/breakthrough', deps.requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const result = await deps.attemptBreakthroughUseCase.execute(req.userId as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 2: Replace `backend/src/app.ts` with the final Phase 1 composition root**

```ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from './infrastructure/db/prisma';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from './infrastructure/repositories/PrismaCharacterRepository';
import { BcryptPasswordHasher } from './infrastructure/auth/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/auth/JwtTokenService';
import { MathRandomSource } from './infrastructure/random/MathRandomSource';
import { RandomSource } from './domain/ports/RandomSource';
import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { GetCultivationStateUseCase } from './application/GetCultivationStateUseCase';
import { AttemptBreakthroughUseCase } from './application/AttemptBreakthroughUseCase';
import { createAuthRouter } from './presentation/routes/auth.routes';
import { createCultivationRouter } from './presentation/routes/cultivation.routes';
import { createRequireAuth } from './presentation/middleware/auth';
import { errorHandler } from './presentation/middleware/errorHandler';

export interface AppOverrides {
  prismaClient?: PrismaClient;
  // Overridable so integration tests can force breakthrough success/failure
  // deterministically instead of depending on real Math.random() outcomes.
  randomSource?: RandomSource;
}

export function createApp(overrides: AppOverrides = {}) {
  const client = overrides.prismaClient ?? defaultPrismaClient;
  const randomSource = overrides.randomSource ?? new MathRandomSource();

  const userRepository = new PrismaUserRepository(client);
  const characterRepository = new PrismaCharacterRepository(client);
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(process.env.JWT_SECRET as string);

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource);

  const requireAuth = createRequireAuth(tokenService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/auth', createAuthRouter({ registerUserUseCase, loginUserUseCase }));
  app.use(
    '/cultivation',
    createCultivationRouter({ getCultivationStateUseCase, attemptBreakthroughUseCase, requireAuth }),
  );

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 3: Write the failing integration test for `GET /cultivation/state`**

Create `backend/tests/integration/cultivation.state.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /cultivation/state', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/cultivation/state');
    expect(res.status).toBe(401);
  });

  it('returns the starting state for a freshly registered character', async () => {
    const token = await registerAndLogin('fiona');
    const res = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.realmName).toBe('Phàm Nhân - Sơ');
    expect(res.body.linhKhiRequired).toBe(100);
    expect(res.body.canBreakthrough).toBe(false);
    expect(res.body.isMaxStage).toBe(false);
  });

  it('does not write to the database on repeated calls', async () => {
    const token = await registerAndLogin('george');
    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const before = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const after = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    expect(after?.lastUpdateAt.getTime()).toBe(before?.lastUpdateAt.getTime());
  });
});
```

- [ ] **Step 4: Run the test to verify it fails, then implement until it passes**

Run: `cd backend && docker compose up -d db && npm test -- tests/integration/cultivation.state.test.ts`
Expected first: FAIL (route not mounted yet, before Step 1/2 above are applied). After Steps 1–2: PASS (3 tests).

- [ ] **Step 5: Write the failing integration test for `POST /cultivation/breakthrough`**

Create `backend/tests/integration/cultivation.breakthrough.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';
import { FixedRandomSource } from '../fakes/FixedRandomSource';

const prismaClientForApp = prisma;

async function registerAndLogin(app: ReturnType<typeof createApp>, username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /cultivation/breakthrough', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const app = createApp({ prismaClient: prismaClientForApp });
    const res = await request(app).post('/cultivation/breakthrough');
    expect(res.status).toBe(401);
  });

  it('rejects with 400 INSUFFICIENT_LINH_KHI when linh khi is below the requirement', async () => {
    const app = createApp({ prismaClient: prismaClientForApp });
    const token = await registerAndLogin(app, 'hannah');

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_LINH_KHI');
  });

  it('advances the substage on a forced success', async () => {
    // randomValue 0 always beats any positive success rate, forcing success.
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'ian');

    const user = await prisma.user.findUnique({ where: { username: 'ian' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.character.realmSub).toBe(1);
    expect(res.body.character.linhKhi).toBe(50);
  });

  it('punishes on a forced failure without deducting linh khi', async () => {
    // randomValue 0.999 beats no realistic success rate, forcing failure.
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0.999) });
    const token = await registerAndLogin(app, 'julia');

    const user = await prisma.user.findUnique({ where: { username: 'julia' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.character.linhKhi).toBe(150);
    expect(res.body.character.punishedUntil).not.toBeNull();
  });

  it('rejects a second attempt with 400 PUNISHED while still in the punishment window', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0.999) });
    const token = await registerAndLogin(app, 'kevin');

    const user = await prisma.user.findUnique({ where: { username: 'kevin' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    await request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`);
    const res = await request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PUNISHED');
  });

  it('rejects with 400 MAX_STAGE_REACHED at Thái Ất - Đại Viên Mãn', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'laura');

    const user = await prisma.user.findUnique({ where: { username: 'laura' } });
    await prisma.character.update({
      where: { userId: user!.id },
      data: { realmMajor: 11, realmSub: 3, linhKhi: 999_999_999 },
    });

    const res = await request(app)
      .post('/cultivation/breakthrough')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MAX_STAGE_REACHED');
  });

  it('rejects the loser of two concurrent breakthrough attempts with 409 CONCURRENT_MODIFICATION', async () => {
    const app = createApp({ prismaClient: prismaClientForApp, randomSource: new FixedRandomSource(0) });
    const token = await registerAndLogin(app, 'mike');

    const user = await prisma.user.findUnique({ where: { username: 'mike' } });
    await prisma.character.update({ where: { userId: user!.id }, data: { linhKhi: 150 } });

    const [first, second] = await Promise.all([
      request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`),
      request(app).post('/cultivation/breakthrough').set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [first.status, second.status].sort();
    // One request wins (200), the other loses the race (409) — order between
    // them is not guaranteed under real concurrency, only that both outcomes occur.
    expect(statuses).toEqual([200, 409]);
  });
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && docker compose up -d db && npm test -- tests/integration/cultivation.breakthrough.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 7: Run the full test suite**

Run: `cd backend && docker compose up -d db && npm test`
Expected: PASS, all unit and integration tests green.

- [ ] **Step 8: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Full-stack manual verification via Docker Compose**

Run: `cd backend && docker compose up -d --build`
Run: `curl -s -X POST http://localhost:3000/auth/register -H 'Content-Type: application/json' -d '{"username":"manual-check","password":"password123"}'`
Expected: `201` with `{"id":"...","username":"manual-check"}`
Run: `curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"username":"manual-check","password":"password123"}'`
Expected: `200` with `{"token":"..."}` — copy the token for the next call.
Run: `curl -s http://localhost:3000/cultivation/state -H "Authorization: Bearer <token>"`
Expected: `200` with `{"realmMajor":0,"realmSub":0,"realmName":"Phàm Nhân - Sơ",...}`

- [ ] **Step 10: Update CLAUDE.md**

Append: "Task 14: wired `GET /cultivation/state` and `POST /cultivation/breakthrough` end-to-end. `createApp(overrides?)` now accepts `randomSource` so tests can force breakthrough success/failure deterministically. Phase 1 backend core is feature-complete: `docker compose up -d --build` then register → login → state → breakthrough all work against real Postgres."

- [ ] **Step 11: Commit**

```bash
git add backend/src/presentation/routes/cultivation.routes.ts backend/src/app.ts backend/tests/integration/cultivation.state.test.ts backend/tests/integration/cultivation.breakthrough.test.ts CLAUDE.md
git commit -m "feat: wire cultivation state and breakthrough endpoints end-to-end"
```

---

## Phase 1 Complete

At this point, the backend implements every requirement in `docs/superpowers/specs/2026-07-12-backend-core-design.md`: register/login (basic JWT via header), `GET /cultivation/state` (lazy, read-only), `POST /cultivation/breakthrough` (pity formula, punishment, carry-over, optimistic-concurrency guard), across all 12 realms × 4 substages, organized as Clean Architecture with domain logic fully unit-tested independent of any database or framework.

Phase 2 (cookie-based access + refresh tokens, CORS, `/auth/refresh`, `/auth/logout`) and Phase 3 (Next.js frontend) each need their own brainstorming session, spec, and plan before implementation — do not start them from this plan.

