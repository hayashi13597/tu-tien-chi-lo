# Backend Auth Cookie Upgrade (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Tu Tiên Chi Lộ's backend auth from a single 7-day JWT returned in the response body (Phase 1) to an access token (15 min) + refresh token (7 days) pair delivered as httpOnly cookies, plus `POST /auth/refresh`, `POST /auth/logout`, and CORS for the future frontend — while keeping the existing `Authorization: Bearer` header path working for non-browser callers.

**Architecture:** Extend the existing Clean Architecture layering from Phase 1 with minimal surface area: the `TokenService` port (domain) gains two methods for refresh tokens; `JwtTokenService` (infrastructure) implements them with a second secret; `RegisterUserUseCase`/`LoginUserUseCase` (application) gain a refresh token in their output; one new use case (`RefreshAccessTokenUseCase`) handles sliding renewal; a new `presentation/cookies.ts` helper centralizes cookie attributes; `requireAuth` middleware gains a cookie-first, header-fallback check; `auth.routes.ts` gains two new routes and cookie-setting on the existing two. No new domain entities, no DB schema changes, no session/revocation storage — refresh tokens are stateless JWTs.

**Tech Stack:** Same as Phase 1 (Node.js, TypeScript, Express, Prisma, PostgreSQL, `jsonwebtoken`, `bcrypt`, `zod`, Vitest + Supertest, Docker Compose) plus two new dependencies: `cookie-parser` ^1.4.6 and `cors` ^2.8.5.

**Spec:** `docs/superpowers/specs/2026-07-13-backend-auth-cookie-design.md`

## Global Constraints

- All backend code lives under `backend/` at the repo root, following the existing Clean Architecture layering from Phase 1 (`domain/` → `application/` → `infrastructure/` → `presentation/`, dependencies point inward only). This plan only touches files inside that structure — no new layers.
- **Two cookies**, both `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`:
  - `access_token`: access JWT, `maxAge: 15 * 60 * 1000` (15 min)
  - `refresh_token`: refresh JWT, `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days)
- **Two distinct JWT secrets** — `JWT_SECRET` (access, existing) and `JWT_REFRESH_SECRET` (refresh, new). A refresh token must never verify successfully as an access token or vice versa.
- Access token expiry shrinks from `'7d'` (Phase 1) to `'15m'`. Refresh token expiry is `'7d'`.
- `PORT` changes from `3000` to `5000` in `.env.example` and `docker-compose.yml` (frees `3000` for the Phase 3 frontend dev server).
- New env var `CORS_ORIGIN=http://localhost:3000` (the future frontend's dev origin).
- CORS: `cors({ origin: process.env.CORS_ORIGIN, credentials: true })` — a single explicit origin, never a wildcard (invalid combined with `credentials: true`).
- `requireAuth` checks `req.cookies?.access_token` first, falls back to the existing `Authorization: Bearer` header if absent — purely additive, no existing caller behavior changes.
- `POST /auth/refresh` reads `req.cookies?.refresh_token` **only** — no header fallback (must work even when the access token has already expired).
- `POST /auth/logout` requires no auth, always responds `200`, unconditionally clears both cookies.
- **Security-critical:** `RegisterUserOutput`/`LoginUserOutput` now carry raw token strings. Routes must select explicit response fields (`res.json({ id, username })` / `res.json({ token })`) — never `res.json(result)` — or a refresh token leaks into the JSON body, defeating httpOnly protection.
- One new error code: `INVALID_REFRESH_TOKEN` (401), added to `errorHandler`'s `STATUS_BY_CODE` map — the single place `DomainError.code` → HTTP status mapping lives (unchanged rule from Phase 1).
- No DB-backed session/refresh-token storage, no revocation list — explicitly out of scope per the spec.
- Non-trivial logic (why two secrets, why cookie-then-header, why logout has no use case) must be commented with the *why*, per this project's mandatory Clean Architecture rule.
- `CLAUDE.md` must be updated after each task.
- Use `ctx7` before writing code against `cookie-parser`, `cors`, or any `res.cookie`/`res.clearCookie` Express API — already checked during planning: `cors({ origin, credentials: true })` is the documented single-origin pattern (confirmed against `/expressjs/cors`); `res.clearCookie(name, { path })` auto-overrides `expires`/`maxAge` but does **not** auto-match `path` — the same `path: '/'` must be passed to both `res.cookie` and `res.clearCookie` calls, or the browser won't recognize them as the same cookie and won't delete it (confirmed against `/expressjs/express`).

---

### Task 1: Domain & infrastructure — extend `TokenService` for refresh tokens

**Files:**
- Modify: `backend/src/domain/ports/TokenService.ts`
- Modify: `backend/src/infrastructure/auth/JwtTokenService.ts`
- Modify: `backend/tests/fakes/FakeTokenService.ts`
- Modify: `backend/tests/unit/JwtTokenService.test.ts`

**Interfaces:**
- Consumes: nothing new (extends the existing `TokenService` port and `JwtTokenService`/`FakeTokenService` from Phase 1).
- Produces: `TokenService.signRefreshToken(userId: string): string`, `TokenService.verifyRefreshToken(token: string): { userId: string }` — consumed by Task 3 (use cases) and Task 4 (`RefreshAccessTokenUseCase`). `JwtTokenService`'s constructor now takes two secrets: `constructor(accessSecret: string, refreshSecret: string)` — consumed by Task 6's composition-root wiring.

- [ ] **Step 1: Update the port `backend/src/domain/ports/TokenService.ts`**

```ts
export interface TokenService {
  signAccessToken(userId: string): string;
  verifyAccessToken(token: string): { userId: string };
  signRefreshToken(userId: string): string;
  verifyRefreshToken(token: string): { userId: string };
}
```

- [ ] **Step 2: Update the fake `backend/tests/fakes/FakeTokenService.ts`**

```ts
import { TokenService } from '../../src/domain/ports/TokenService';

export class FakeTokenService implements TokenService {
  signAccessToken(userId: string): string {
    return `access-token-for-${userId}`;
  }

  verifyAccessToken(token: string): { userId: string } {
    if (!token.startsWith('access-token-for-')) {
      throw new Error('invalid token');
    }
    return { userId: token.replace('access-token-for-', '') };
  }

  signRefreshToken(userId: string): string {
    return `refresh-token-for-${userId}`;
  }

  verifyRefreshToken(token: string): { userId: string } {
    if (!token.startsWith('refresh-token-for-')) {
      throw new Error('invalid token');
    }
    return { userId: token.replace('refresh-token-for-', '') };
  }
}
```

(Prefixes changed from Phase 1's bare `token-for-` to `access-token-for-`/`refresh-token-for-` so the fake can distinguish token kinds — an access token string will never accidentally satisfy `verifyRefreshToken`'s prefix check, matching the real `JwtTokenService`'s two-secret behavior. This changes existing callers: Task 3 updates `LoginUserUseCase.test.ts`'s expected literal.)

- [ ] **Step 3: Write the failing tests for `JwtTokenService`'s refresh methods**

Replace `backend/tests/unit/JwtTokenService.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { JwtTokenService } from '../../src/infrastructure/auth/JwtTokenService';

describe('JwtTokenService', () => {
  describe('access tokens', () => {
    it('signs a token that verifies back to the same userId', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signAccessToken('user-123');
      expect(service.verifyAccessToken(token)).toEqual({ userId: 'user-123' });
    });

    it('throws when verifying an access token signed with a different access secret', () => {
      const signer = new JwtTokenService('access-secret-a', 'refresh-secret');
      const verifier = new JwtTokenService('access-secret-b', 'refresh-secret');
      const token = signer.signAccessToken('user-123');
      expect(() => verifier.verifyAccessToken(token)).toThrow();
    });

    it('throws when verifying garbage input as an access token', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      expect(() => service.verifyAccessToken('not-a-real-token')).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('signs a refresh token that verifies back to the same userId', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signRefreshToken('user-123');
      expect(service.verifyRefreshToken(token)).toEqual({ userId: 'user-123' });
    });

    it('throws when verifying a refresh token signed with a different refresh secret', () => {
      const signer = new JwtTokenService('access-secret', 'refresh-secret-a');
      const verifier = new JwtTokenService('access-secret', 'refresh-secret-b');
      const token = signer.signRefreshToken('user-123');
      expect(() => verifier.verifyRefreshToken(token)).toThrow();
    });
  });

  describe('secret isolation between token kinds', () => {
    it('rejects a refresh token presented to verifyAccessToken when secrets differ', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const refreshToken = service.signRefreshToken('user-123');
      expect(() => service.verifyAccessToken(refreshToken)).toThrow();
    });

    it('rejects an access token presented to verifyRefreshToken when secrets differ', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const accessToken = service.signAccessToken('user-123');
      expect(() => service.verifyRefreshToken(accessToken)).toThrow();
    });
  });

  describe('token uniqueness (jti)', () => {
    it('signs two different access tokens for the same userId, even issued in the same instant', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const first = service.signAccessToken('user-123');
      const second = service.signAccessToken('user-123');
      // Without a random jti, jwt.sign() is a deterministic HMAC over
      // { userId, iat, exp } + secret, and iat/exp only have second-level
      // granularity — two calls in the same wall-clock second would
      // otherwise produce byte-identical tokens, silently breaking the
      // sliding-refresh guarantee that every refresh issues a new token.
      expect(first).not.toBe(second);
    });

    it('signs two different refresh tokens for the same userId, even issued in the same instant', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const first = service.signRefreshToken('user-123');
      const second = service.signRefreshToken('user-123');
      expect(first).not.toBe(second);
    });
  });

  describe('access token expiry', () => {
    it('signs an access token with a 15-minute expiry', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signAccessToken('user-123');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('signs a refresh token with a 7-day expiry', () => {
      const service = new JwtTokenService('access-secret', 'refresh-secret');
      const token = service.signRefreshToken('user-123');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && npm test -- tests/unit/JwtTokenService.test.ts`
Expected: FAIL — `JwtTokenService` constructor still takes one argument, `signRefreshToken`/`verifyRefreshToken` don't exist yet, `signAccessToken`'s expiry is still `'7d'`.

- [ ] **Step 5: Update `backend/src/infrastructure/auth/JwtTokenService.ts`**

```ts
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  signAccessToken(userId: string): string {
    // jti (a random per-token id) is required, not cosmetic: jwt.sign() is a
    // deterministic HMAC over { userId, iat, exp } + secret, and iat/exp only
    // have second-level granularity. Two calls for the same userId within the
    // same wall-clock second (e.g. register immediately followed by refresh)
    // would otherwise produce byte-identical tokens, silently breaking the
    // sliding-refresh guarantee that every refresh issues a genuinely new
    // token (see RefreshAccessTokenUseCase in Task 4).
    return jwt.sign({ userId, jti: randomUUID() }, this.accessSecret, { expiresIn: '15m' });
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.accessSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId, jti: randomUUID() }, this.refreshSecret, { expiresIn: '7d' });
  }

  // Verifies exclusively against refreshSecret — a token signed with
  // accessSecret (or any other secret) fails here, since jsonwebtoken's
  // verify() rejects a signature that doesn't match the secret it's checked
  // against. This is what makes a leaked access token unusable as a refresh
  // token and vice versa: the two token kinds are cryptographically
  // independent, not just conventionally different strings.
  verifyRefreshToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.refreshSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && npm test -- tests/unit/JwtTokenService.test.ts`
Expected: PASS (9 tests). (Note: Task 6 later discovers and fixes a real determinism bug in `signAccessToken`/`signRefreshToken` — missing `jti` — and adds a `describe('token uniqueness (jti)')` block with 2 more tests to this same file, bringing the total to 11. That addition is documented in this file's Task 6 section, not retrofitted here, since it wasn't known at the time this task was first written.)

- [ ] **Step 7: Run the full suite to check for regressions from the `FakeTokenService` prefix change**

Run: `cd backend && docker compose up -d db && npm test`
Expected: FAIL on `tests/unit/LoginUserUseCase.test.ts` (hardcodes the old `token-for-user-1` literal; fixed in Task 3). `tests/unit/auth.middleware.test.ts` does NOT hardcode a literal — it round-trips via `signAccessToken`/`verifyAccessToken` and only asserts on the resulting `userId`, so it stays green through this prefix change (Task 5 still updates it later, but for the cookie-fallback feature itself, not because of breakage here). If any file *other than* `LoginUserUseCase.test.ts` fails, stop and investigate before continuing — don't assume it's expected.

- [ ] **Step 8: Update CLAUDE.md**

Append under "## Backend Progress": "Task 1 (Phase 2): extended `TokenService` port with `signRefreshToken`/`verifyRefreshToken`; `JwtTokenService` now takes two secrets (`accessSecret`, `refreshSecret`) and signs access tokens with a 15-minute expiry (down from Phase 1's 7 days) and refresh tokens with a 7-day expiry. `FakeTokenService`'s token-string prefixes changed to distinguish access vs refresh tokens — `tests/unit/LoginUserUseCase.test.ts` needs updating in Task 3 (hardcoded the old literal); `tests/unit/auth.middleware.test.ts` was unaffected (no hardcoded literal) but Task 5 still updates it for the cookie-fallback feature."

- [ ] **Step 9: Commit**

```bash
git add backend/src/domain/ports/TokenService.ts backend/src/infrastructure/auth/JwtTokenService.ts backend/tests/fakes/FakeTokenService.ts backend/tests/unit/JwtTokenService.test.ts CLAUDE.md
git commit -m "feat: add refresh token support to TokenService and JwtTokenService"
```

---

### Task 2: Presentation — `cookies.ts` helper + new dependencies

**Files:**
- Modify: `backend/package.json` (add `cookie-parser`, `cors` deps + `@types/cookie-parser`, `@types/cors` devDeps)
- Create: `backend/src/presentation/cookies.ts`
- Test: `backend/tests/unit/cookies.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `setAuthCookies(res: Response, accessToken: string, refreshToken: string): void`, `clearAuthCookies(res: Response): void` — consumed by Task 6's `auth.routes.ts` changes.

- [ ] **Step 1: Add dependencies to `backend/package.json`**

Update the `dependencies` and `devDependencies` blocks to:

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
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
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
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: Install the new dependencies**

Run: `cd backend && npm install`
Expected: `node_modules/cookie-parser` and `node_modules/cors` now present; `package-lock.json` updated; no errors.

- [ ] **Step 3: Write the failing test**

Create `backend/tests/unit/cookies.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setAuthCookies, clearAuthCookies } from '../../src/presentation/cookies';

function buildTestApp() {
  const app = express();
  app.get('/set', (_req, res) => {
    setAuthCookies(res, 'the-access-token', 'the-refresh-token');
    res.status(200).json({ ok: true });
  });
  app.get('/clear', (_req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('setAuthCookies', () => {
  it('sets both cookies as httpOnly with the expected names and values', async () => {
    const res = await request(buildTestApp()).get('/set');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    expect(accessCookie).toContain('access_token=the-access-token');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toContain('SameSite=Lax');

    expect(refreshCookie).toContain('refresh_token=the-refresh-token');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toContain('SameSite=Lax');
  });

  it('sets access_token with a 15-minute max-age and refresh_token with a 7-day max-age', async () => {
    const res = await request(buildTestApp()).get('/set');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    // Express renders maxAge (ms) as a Max-Age (seconds) attribute.
    expect(accessCookie).toContain(`Max-Age=${15 * 60}`);
    expect(refreshCookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  });
});

describe('clearAuthCookies', () => {
  it('clears both cookies with an expired date and matching path', async () => {
    const res = await request(buildTestApp()).get('/clear');
    const cookies = res.headers['set-cookie'] as unknown as string[];

    const accessCookie = cookies.find((c) => c.startsWith('access_token='));
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));

    expect(accessCookie).toContain('access_token=;');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toContain('Expires=Thu, 01 Jan 1970');

    expect(refreshCookie).toContain('refresh_token=;');
    expect(refreshCookie).toContain('Path=/');
    expect(refreshCookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/cookies.test.ts`
Expected: FAIL with a module-not-found error for `../../src/presentation/cookies`

- [ ] **Step 5: Create `backend/src/presentation/cookies.ts`**

```ts
import { Response } from 'express';

// Shared attributes for both cookies. secure is gated on NODE_ENV so cookies
// still work over plain http://localhost in dev, but are forced over HTTPS
// once deployed. Centralizing these means all 4 call sites (register, login,
// refresh, logout) can never drift out of sync with each other.
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token', accessToken, { ...COOKIE_BASE_OPTIONS, maxAge: ACCESS_TOKEN_MAX_AGE_MS });
  res.cookie('refresh_token', refreshToken, { ...COOKIE_BASE_OPTIONS, maxAge: REFRESH_TOKEN_MAX_AGE_MS });
}

export function clearAuthCookies(res: Response): void {
  // clearCookie's own expires/maxAge is always overridden to a past date
  // regardless of what's passed, but its `path` is NOT auto-matched to what
  // cookie() used — passing the same path: '/' here is what makes the
  // browser recognize this as the same cookie and actually delete it.
  res.clearCookie('access_token', { path: COOKIE_BASE_OPTIONS.path });
  res.clearCookie('refresh_token', { path: COOKIE_BASE_OPTIONS.path });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/cookies.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Update CLAUDE.md**

Append: "Task 2 (Phase 2): added `cookie-parser`/`cors` dependencies and `presentation/cookies.ts` (`setAuthCookies`/`clearAuthCookies`), centralizing cookie attributes so all 4 auth call sites (register/login/refresh/logout) stay in sync."

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/presentation/cookies.ts backend/tests/unit/cookies.test.ts CLAUDE.md
git commit -m "feat: add cookie-parser/cors deps and setAuthCookies/clearAuthCookies helper"
```

---

### Task 3: Application — `RegisterUserUseCase`/`LoginUserUseCase` issue refresh tokens

**Files:**
- Modify: `backend/src/application/RegisterUserUseCase.ts`
- Modify: `backend/src/application/LoginUserUseCase.ts`
- Modify: `backend/tests/unit/RegisterUserUseCase.test.ts`
- Modify: `backend/tests/unit/LoginUserUseCase.test.ts`

**Interfaces:**
- Consumes: `TokenService` (Task 1, now with `signRefreshToken`), `UserRepository`, `PasswordHasher`, `DomainError` (all Phase 1, unchanged).
- Produces: `RegisterUserUseCase` constructor now takes `(users: UserRepository, passwordHasher: PasswordHasher, tokenService: TokenService)` and `execute()` returns `RegisterUserOutput = { id: string; username: string; accessToken: string; refreshToken: string }`. `LoginUserUseCase.execute()` returns `LoginUserOutput = { token: string; refreshToken: string }` (constructor signature unchanged from Phase 1). Both consumed by Task 6's `auth.routes.ts` changes.

- [ ] **Step 1: Update the failing test for `RegisterUserUseCase`**

Replace `backend/tests/unit/RegisterUserUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('RegisterUserUseCase', () => {
  it('creates a user and returns id, username, and both tokens', async () => {
    const useCase = new RegisterUserUseCase(
      new InMemoryUserRepository(),
      new FakePasswordHasher(),
      new FakeTokenService(),
    );
    const result = await useCase.execute({ username: 'alice', password: 'password123' });

    expect(result.username).toBe('alice');
    expect(typeof result.id).toBe('string');
    expect(result.accessToken).toBe(`access-token-for-${result.id}`);
    expect(result.refreshToken).toBe(`refresh-token-for-${result.id}`);
  });

  it('rejects a duplicate username with USERNAME_TAKEN', async () => {
    const users = new InMemoryUserRepository();
    const useCase = new RegisterUserUseCase(users, new FakePasswordHasher(), new FakeTokenService());
    await useCase.execute({ username: 'bob', password: 'password123' });

    await expect(useCase.execute({ username: 'bob', password: 'password456' })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/RegisterUserUseCase.test.ts`
Expected: FAIL — constructor takes 2 args today, `result.accessToken`/`result.refreshToken` don't exist.

- [ ] **Step 3: Update `backend/src/application/RegisterUserUseCase.ts`**

```ts
import { UserRepository } from '../domain/ports/UserRepository';
import { PasswordHasher } from '../domain/ports/PasswordHasher';
import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface RegisterUserInput {
  username: string;
  password: string;
}

export interface RegisterUserOutput {
  id: string;
  username: string;
  accessToken: string;
  refreshToken: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.users.findByUsername(input.username);
    if (existing) {
      throw new DomainError('USERNAME_TAKEN', 'Username already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({ username: input.username, passwordHash });

    // Register also logs the user in immediately (per the design spec), so
    // the route can set the same cookie pair login does without a second
    // round trip. The route decides what to expose in the JSON body — see
    // the Global Constraints note on never echoing the raw result object.
    const accessToken = this.tokenService.signAccessToken(user.id);
    const refreshToken = this.tokenService.signRefreshToken(user.id);

    return { id: user.id, username: user.username, accessToken, refreshToken };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/RegisterUserUseCase.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Update the failing test for `LoginUserUseCase`**

Replace `backend/tests/unit/LoginUserUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegisterUserUseCase } from '../../src/application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../src/application/LoginUserUseCase';
import { InMemoryUserRepository } from '../fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../fakes/FakePasswordHasher';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('LoginUserUseCase', () => {
  it('returns an access token and a refresh token for valid credentials', async () => {
    const users = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();
    const registered = await new RegisterUserUseCase(users, passwordHasher, tokenService).execute({
      username: 'dave',
      password: 'password123',
    });

    const useCase = new LoginUserUseCase(users, passwordHasher, tokenService);
    const result = await useCase.execute({ username: 'dave', password: 'password123' });

    expect(result.token).toBe(`access-token-for-${registered.id}`);
    expect(result.refreshToken).toBe(`refresh-token-for-${registered.id}`);
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
    const tokenService = new FakeTokenService();
    await new RegisterUserUseCase(users, passwordHasher, tokenService).execute({
      username: 'erin',
      password: 'password123',
    });

    const useCase = new LoginUserUseCase(users, passwordHasher, tokenService);
    await expect(useCase.execute({ username: 'erin', password: 'wrongpass1' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/LoginUserUseCase.test.ts`
Expected: FAIL — `result.refreshToken` doesn't exist yet, and the old test's hardcoded `token-for-user-1` literal no longer matches the new fake's prefix.

- [ ] **Step 7: Update `backend/src/application/LoginUserUseCase.ts`**

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
  refreshToken: string;
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
    const refreshToken = this.tokenService.signRefreshToken(user.id);
    return { token, refreshToken };
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/LoginUserUseCase.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Update CLAUDE.md**

Append: "Task 3 (Phase 2): `RegisterUserUseCase` now takes a `TokenService` and issues both tokens on registration (register also logs in); `LoginUserUseCase.execute()` now also returns `refreshToken` alongside the existing `token`."

- [ ] **Step 10: Commit**

```bash
git add backend/src/application/RegisterUserUseCase.ts backend/src/application/LoginUserUseCase.ts backend/tests/unit/RegisterUserUseCase.test.ts backend/tests/unit/LoginUserUseCase.test.ts CLAUDE.md
git commit -m "feat: RegisterUserUseCase and LoginUserUseCase issue refresh tokens"
```

---

### Task 4: Application — `RefreshAccessTokenUseCase` + `INVALID_REFRESH_TOKEN` error mapping

**Files:**
- Create: `backend/src/application/RefreshAccessTokenUseCase.ts`
- Test: `backend/tests/unit/RefreshAccessTokenUseCase.test.ts`
- Modify: `backend/src/presentation/middleware/errorHandler.ts`
- Modify: `backend/tests/unit/errorHandler.test.ts`

**Interfaces:**
- Consumes: `TokenService` (Task 1), `DomainError` (Phase 1).
- Produces: `RefreshAccessTokenUseCase` (`execute(refreshToken: string): { token: string; refreshToken: string }`) — consumed by Task 6's `auth.routes.ts`. Adds `INVALID_REFRESH_TOKEN: 401` to `errorHandler`'s status map.

- [ ] **Step 1: Write the failing test for `RefreshAccessTokenUseCase`**

Create `backend/tests/unit/RefreshAccessTokenUseCase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RefreshAccessTokenUseCase } from '../../src/application/RefreshAccessTokenUseCase';
import { FakeTokenService } from '../fakes/FakeTokenService';

describe('RefreshAccessTokenUseCase', () => {
  it('issues a new access token and a new refresh token for a valid refresh token', () => {
    const tokenService = new FakeTokenService();
    const originalRefreshToken = tokenService.signRefreshToken('user-123');

    const useCase = new RefreshAccessTokenUseCase(tokenService);
    const result = useCase.execute(originalRefreshToken);

    expect(result.token).toBe('access-token-for-user-123');
    expect(result.refreshToken).toBe('refresh-token-for-user-123');
  });

  it('rejects an invalid refresh token with INVALID_REFRESH_TOKEN', () => {
    const useCase = new RefreshAccessTokenUseCase(new FakeTokenService());
    expect(() => useCase.execute('not-a-real-refresh-token')).toThrowError(
      expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    );
  });

  it('rejects an access token presented as a refresh token with INVALID_REFRESH_TOKEN', () => {
    const tokenService = new FakeTokenService();
    const accessToken = tokenService.signAccessToken('user-123');

    const useCase = new RefreshAccessTokenUseCase(tokenService);
    expect(() => useCase.execute(accessToken)).toThrowError(
      expect.objectContaining({ code: 'INVALID_REFRESH_TOKEN' }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/RefreshAccessTokenUseCase.test.ts`
Expected: FAIL with a module-not-found error

- [ ] **Step 3: Create `backend/src/application/RefreshAccessTokenUseCase.ts`**

```ts
import { TokenService } from '../domain/ports/TokenService';
import { DomainError } from '../domain/errors';

export interface RefreshAccessTokenOutput {
  token: string;
  refreshToken: string;
}

export class RefreshAccessTokenUseCase {
  constructor(private readonly tokenService: TokenService) {}

  // Sliding renewal: every successful refresh issues a BRAND NEW refresh
  // token (not the same one re-signed), extending the session another 7
  // days from this moment. There is no server-side session/revocation
  // store (see Global Constraints) — a refresh token's only route to
  // invalidation is expiring naturally.
  execute(refreshToken: string): RefreshAccessTokenOutput {
    let userId: string;
    try {
      ({ userId } = this.tokenService.verifyRefreshToken(refreshToken));
    } catch {
      throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const token = this.tokenService.signAccessToken(userId);
    const newRefreshToken = this.tokenService.signRefreshToken(userId);
    return { token, refreshToken: newRefreshToken };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/RefreshAccessTokenUseCase.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for the new error mapping**

In `backend/tests/unit/errorHandler.test.ts`, add a new route and test case. Replace the whole file with:

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
  app.get('/boom-invalid-refresh-token', () => {
    throw new DomainError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
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

  it('maps INVALID_REFRESH_TOKEN to 401', async () => {
    const res = await request(buildTestApp()).get('/boom-invalid-refresh-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
    });
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

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/errorHandler.test.ts`
Expected: FAIL on the new `'maps INVALID_REFRESH_TOKEN to 401'` case — falls through to the unmapped-code branch (500) today.

- [ ] **Step 7: Update `backend/src/presentation/middleware/errorHandler.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { DomainError } from '../../domain/errors';

// The only place DomainError.code is mapped to an HTTP status — keeps that
// mapping decision out of domain/ and application/ entirely.
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
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

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/errorHandler.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Update CLAUDE.md**

Append: "Task 4 (Phase 2): added `RefreshAccessTokenUseCase` (`src/application/`, sliding renewal — issues a brand new refresh token on every successful refresh, not a re-signed copy) and mapped `INVALID_REFRESH_TOKEN` to 401 in `errorHandler`."

- [ ] **Step 10: Commit**

```bash
git add backend/src/application/RefreshAccessTokenUseCase.ts backend/tests/unit/RefreshAccessTokenUseCase.test.ts backend/src/presentation/middleware/errorHandler.ts backend/tests/unit/errorHandler.test.ts CLAUDE.md
git commit -m "feat: add RefreshAccessTokenUseCase and INVALID_REFRESH_TOKEN error mapping"
```

---

### Task 5: Presentation — `requireAuth` cookie-then-header fallback

**Files:**
- Modify: `backend/src/presentation/middleware/auth.ts`
- Modify: `backend/tests/unit/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `TokenService` (Task 1), `AuthedRequest` (Phase 1, unchanged shape).
- Produces: `createRequireAuth(tokenService: TokenService)` — same signature as Phase 1, behavior extended. Consumed by Task 6's composition-root wiring (unchanged call site).

Note: this middleware reads `req.cookies`, which is populated by the `cookie-parser` middleware mounted earlier in the request pipeline (wired in Task 6's `app.ts` change). In this task's own unit tests, requests are made directly with Supertest against a bare Express app that does **not** mount `cookie-parser` — so `req.cookies` is `undefined` for those tests unless the test app mounts it too. The test below mounts `cookie-parser` in its own tiny test app to exercise the cookie path realistically.

- [ ] **Step 1: Update the failing test `backend/tests/unit/auth.middleware.test.ts`**

Replace the whole file:

```ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createRequireAuth, AuthedRequest } from '../../src/presentation/middleware/auth';
import { FakeTokenService } from '../fakes/FakeTokenService';

function buildTestApp() {
  const app = express();
  app.use(cookieParser());
  const requireAuth = createRequireAuth(new FakeTokenService());
  app.get('/protected', requireAuth, (req: AuthedRequest, res) => {
    res.status(200).json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('rejects requests with neither a cookie nor a header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid Authorization header with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid access_token cookie with 401', async () => {
    const res = await request(buildTestApp()).get('/protected').set('Cookie', 'access_token=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('allows requests with a valid Authorization header and attaches userId (existing header-only callers keep working)', async () => {
    const token = new FakeTokenService().signAccessToken('user-123');
    const res = await request(buildTestApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-123');
  });

  it('allows requests with a valid access_token cookie and attaches userId', async () => {
    const token = new FakeTokenService().signAccessToken('user-456');
    const res = await request(buildTestApp()).get('/protected').set('Cookie', `access_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-456');
  });

  it('prefers the cookie over the header when both are present and resolve to different users', async () => {
    const cookieToken = new FakeTokenService().signAccessToken('user-from-cookie');
    const headerToken = new FakeTokenService().signAccessToken('user-from-header');
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${cookieToken}`)
      .set('Authorization', `Bearer ${headerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-from-cookie');
  });

  it('rejects a refresh token presented as the access_token cookie with 401', () => {
    const refreshToken = new FakeTokenService().signRefreshToken('user-123');
    return request(buildTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${refreshToken}`)
      .then((res) => {
        expect(res.status).toBe(401);
      });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/unit/auth.middleware.test.ts`
Expected: FAIL — `requireAuth` doesn't read `req.cookies` yet, so cookie-only and cookie-precedence cases get 401 instead of 200.

- [ ] **Step 3: Update `backend/src/presentation/middleware/auth.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../domain/ports/TokenService';

export interface AuthedRequest extends Request {
  userId?: string;
}

// Factory, not a bare middleware: depends on the TokenService port rather
// than importing jsonwebtoken directly, so presentation/ stays decoupled
// from which token implementation the composition root wires in.
export function createRequireAuth(tokenService: TokenService) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    // Cookie takes precedence over the header: browser callers (the
    // intended Phase 2 audience) always send the cookie once logged in, so
    // checking it first means a stale/manually-set header can never shadow
    // the session the browser's cookie jar actually holds.
    const cookieToken = req.cookies?.access_token as string | undefined;
    const header = req.headers.authorization;
    const headerToken =
      header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    const token = cookieToken ?? headerToken;
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token or access_token cookie' } });
      return;
    }

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/unit/auth.middleware.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Update CLAUDE.md**

Append: "Task 5 (Phase 2): `requireAuth` now checks `req.cookies?.access_token` first, falling back to the `Authorization: Bearer` header — additive, existing header-only callers still work. Requires `cookie-parser` mounted ahead of it in the pipeline (wired in Task 6)."

- [ ] **Step 6: Commit**

```bash
git add backend/src/presentation/middleware/auth.ts backend/tests/unit/auth.middleware.test.ts CLAUDE.md
git commit -m "feat: requireAuth checks access_token cookie before the Authorization header"
```

---

### Task 6: Wire it all together — routes, composition root, env, CORS

**Files:**
- Modify: `backend/src/presentation/routes/auth.routes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/.env.example`
- Modify: `backend/docker-compose.yml`
- Modify: `backend/tests/integration/auth.routes.test.ts`
- Test: `backend/tests/integration/cors.test.ts`

**Interfaces:**
- Consumes: `RefreshAccessTokenUseCase` (Task 4), `setAuthCookies`/`clearAuthCookies` (Task 2), `RegisterUserUseCase`/`LoginUserUseCase` (Task 3, updated outputs), `createRequireAuth` (Task 5), `JwtTokenService` (Task 1, two-arg constructor).
- Produces: `createAuthRouter(deps): Router` now also handles `POST /auth/refresh` and `POST /auth/logout`. `createApp()`'s composition root wires `cookieParser()`, `cors(...)`, and the two-secret `JwtTokenService`. This is the final integration point for Phase 2 — no later task depends on anything from this one.

- [ ] **Step 1: Update `backend/.env.example`**

```
DATABASE_URL=postgresql://game:game@localhost:5432/tu_tien_chi_lo
JWT_SECRET=dev-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
CORS_ORIGIN=http://localhost:3000
PORT=5000
```

- [ ] **Step 2: Copy the updated example to your local `.env`**

Run: `cp backend/.env.example backend/.env`

- [ ] **Step 3: Update `backend/docker-compose.yml`**

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
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://game:game@db:5432/tu_tien_chi_lo
      JWT_SECRET: dev-secret-change-me
      JWT_REFRESH_SECRET: dev-refresh-secret-change-me
      CORS_ORIGIN: http://localhost:3000
      PORT: 5000
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma
    depends_on:
      - db

volumes:
  db_data:
```

- [ ] **Step 4: Update `backend/src/presentation/routes/auth.routes.ts`**

```ts
import { Router } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';
import { RegisterUserUseCase } from '../../application/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/LoginUserUseCase';
import { RefreshAccessTokenUseCase } from '../../application/RefreshAccessTokenUseCase';
import { DomainError } from '../../domain/errors';
import { setAuthCookies, clearAuthCookies } from '../cookies';

export interface AuthRouterDeps {
  registerUserUseCase: RegisterUserUseCase;
  loginUserUseCase: LoginUserUseCase;
  refreshAccessTokenUseCase: RefreshAccessTokenUseCase;
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
      setAuthCookies(res, result.accessToken, result.refreshToken);
      // Explicit field selection — never res.json(result) — so accessToken/
      // refreshToken never leak into the JSON body; they travel only via
      // the httpOnly cookies just set above.
      res.status(201).json({ id: result.id, username: result.username });
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
      setAuthCookies(res, result.token, result.refreshToken);
      // Response body keeps its Phase 1 shape ({ token }) for header-based
      // callers; refreshToken is cookie-only, never in the JSON body.
      res.status(200).json({ token: result.token });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      // Cookie only, no header fallback: the whole point of this endpoint is
      // to work once the access token has already expired.
      const refreshToken = req.cookies?.refresh_token as string | undefined;
      if (!refreshToken) {
        throw new DomainError('INVALID_REFRESH_TOKEN', 'Missing refresh token');
      }
      const result = deps.refreshAccessTokenUseCase.execute(refreshToken);
      setAuthCookies(res, result.token, result.refreshToken);
      res.status(200).json({ token: result.token });
    } catch (err) {
      next(err);
    }
  });

  // No use case, no auth, no DB read: logout has zero business logic (it's
  // idempotent and always succeeds, whether or not the caller had a session),
  // so it's handled directly here rather than through an application-layer
  // indirection with nothing to orchestrate.
  router.post('/logout', (_req, res) => {
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
  });

  return router;
}
```

- [ ] **Step 5: Update `backend/src/app.ts`**

```ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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
import { RefreshAccessTokenUseCase } from './application/RefreshAccessTokenUseCase';
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
  const tokenService = new JwtTokenService(
    process.env.JWT_SECRET as string,
    process.env.JWT_REFRESH_SECRET as string,
  );

  const registerUserUseCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);
  const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
  const refreshAccessTokenUseCase = new RefreshAccessTokenUseCase(tokenService);
  const getCultivationStateUseCase = new GetCultivationStateUseCase(characterRepository);
  const attemptBreakthroughUseCase = new AttemptBreakthroughUseCase(characterRepository, randomSource);

  const requireAuth = createRequireAuth(tokenService);

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(
    '/auth',
    createAuthRouter({ registerUserUseCase, loginUserUseCase, refreshAccessTokenUseCase }),
  );
  app.use(
    '/cultivation',
    createCultivationRouter({ getCultivationStateUseCase, attemptBreakthroughUseCase, requireAuth }),
  );

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 6: Update `backend/tests/setup.ts` to provide a test refresh secret**

Replace `backend/tests/setup.ts`:

```ts
import 'dotenv/config';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
```

- [ ] **Step 7: Update the failing integration test `backend/tests/integration/auth.routes.test.ts`**

Replace the whole file:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

function findCookie(res: request.Response, name: string): string | undefined {
  const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  return cookies.find((c) => c.startsWith(`${name}=`));
}

beforeEach(async () => {
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('creates a user and a default character, and sets both auth cookies', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), username: 'alice' });
    expect(findCookie(res, 'access_token')).toContain('HttpOnly');
    expect(findCookie(res, 'refresh_token')).toContain('HttpOnly');

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

  it('allows a subsequent authenticated request with no Authorization header, using the cookie jar', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'fiona', password: 'password123' });

    const res = await agent.get('/cultivation/state');
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT for valid credentials and sets both auth cookies', async () => {
    await request(app).post('/auth/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'dave', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.refreshToken).toBeUndefined();
    expect(findCookie(res, 'access_token')).toContain('HttpOnly');
    expect(findCookie(res, 'refresh_token')).toContain('HttpOnly');
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/auth/register').send({ username: 'erin', password: 'password123' });
    const res = await request(app).post('/auth/login').send({ username: 'erin', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows a subsequent authenticated request with no Authorization header, using the cookie jar', async () => {
    await request(app).post('/auth/register').send({ username: 'george', password: 'password123' });
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username: 'george', password: 'password123' });

    const res = await agent.get('/cultivation/state');
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/refresh', () => {
  it('issues new cookies from a valid refresh_token cookie, and the agent can still reach a protected route', async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post('/auth/register').send({ username: 'hannah', password: 'password123' });
    const originalAccessCookie = findCookie(registerRes, 'access_token');
    const originalRefreshCookie = findCookie(registerRes, 'refresh_token');

    const refreshRes = await agent.post('/auth/refresh');
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.token).toBe('string');
    expect(findCookie(refreshRes, 'access_token')).not.toBe(originalAccessCookie);
    expect(findCookie(refreshRes, 'refresh_token')).not.toBe(originalRefreshCookie);

    const stateRes = await agent.get('/cultivation/state');
    expect(stateRes.status).toBe(200);
  });

  it('rejects a missing refresh_token cookie with 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects a tampered refresh_token cookie with 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app).post('/auth/refresh').set('Cookie', 'refresh_token=not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  it('clears both cookies and subsequent requests on the same agent are rejected', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'ian', password: 'password123' });

    const logoutRes = await agent.post('/auth/logout');
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ message: 'Logged out' });
    expect(findCookie(logoutRes, 'access_token')).toContain('access_token=;');
    expect(findCookie(logoutRes, 'refresh_token')).toContain('refresh_token=;');

    const stateRes = await agent.get('/cultivation/state');
    expect(stateRes.status).toBe(401);

    const refreshRes = await agent.post('/auth/refresh');
    expect(refreshRes.status).toBe(401);
  });

  it('is idempotent — succeeds even with no prior session', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Logged out' });
  });
});
```

- [ ] **Step 8: Run the tests to verify they pass**

Ensure the dev database is up: `cd backend && docker compose up -d db`
Run: `cd backend && npm test -- tests/integration/auth.routes.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 9: Write the failing CORS smoke test**

Create `backend/tests/integration/cors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

describe('CORS', () => {
  it('reflects the configured origin with credentials allowed', async () => {
    const app = createApp();
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    await prisma.$disconnect();
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `cd backend && npm test -- tests/integration/cors.test.ts`
Expected: FAIL — `app.ts` doesn't mount `cors()` yet at this point if Step 5 hasn't been applied; since Step 5 is already written above, running this after Step 5 should already PASS. Run it to confirm.

- [ ] **Step 11: Run the test to verify it passes**

Run: `cd backend && npm test -- tests/integration/cors.test.ts`
Expected: PASS (1 test)

- [ ] **Step 12: Run the full test suite**

Run: `cd backend && docker compose up -d db && npm test`
Expected: PASS, all unit and integration tests green (Phase 1's cultivation tests plus all of Phase 2's new/updated tests).

- [ ] **Step 13: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 14: Full-stack manual verification via Docker Compose**

Run: `cd backend && docker compose up -d --build`
Run: `curl -s -i -c /tmp/cookies.txt -X POST http://localhost:5000/auth/register -H 'Content-Type: application/json' -d '{"username":"manual-check-2","password":"password123"}'`
Expected: `201`, body `{"id":"...","username":"manual-check-2"}`, response headers include two `Set-Cookie` lines (`access_token=...`, `refresh_token=...`), both written to `/tmp/cookies.txt` by curl's `-c` flag.
Run: `curl -s -i -b /tmp/cookies.txt http://localhost:5000/cultivation/state`
Expected: `200` with the character's starting state — no `Authorization` header needed, curl sends the cookies from `/tmp/cookies.txt`.
Run: `curl -s -i -b /tmp/cookies.txt -c /tmp/cookies.txt -X POST http://localhost:5000/auth/refresh`
Expected: `200` with `{"token":"..."}`, new `Set-Cookie` headers for both cookies, and `/tmp/cookies.txt` updated in place (`-b` and `-c` on the same file).
Run: `curl -s -i -b /tmp/cookies.txt -X POST http://localhost:5000/auth/logout`
Expected: `200` with `{"message":"Logged out"}`.
Run: `curl -s http://localhost:5000/health -H 'Origin: http://localhost:3000' -i`
Expected: response headers include `Access-Control-Allow-Origin: http://localhost:3000` and `Access-Control-Allow-Credentials: true`.

- [ ] **Step 15: Fix a cross-cutting bug in `JwtTokenService` (Task 1) surfaced by this task's own integration tests**

While writing this task's integration tests (`auth.routes.test.ts`'s refresh test asserts the new cookie values differ from the pre-refresh ones), a real bug surfaces in `backend/src/infrastructure/auth/JwtTokenService.ts` (created in Task 1): `signAccessToken`/`signRefreshToken` sign only `{ userId }`, and `jwt.sign()` is a deterministic HMAC over `{ userId, iat, exp }` + secret — `iat`/`exp` only have second-level granularity, so two tokens issued for the same user within the same wall-clock second (e.g. register immediately followed by refresh) are byte-identical, silently breaking the sliding-refresh guarantee that every refresh issues a genuinely new token.

Fix by adding a random `jti` (JWT ID) claim to both signing methods:

```ts
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../domain/ports/TokenService';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
  ) {}

  signAccessToken(userId: string): string {
    return jwt.sign({ userId, jti: randomUUID() }, this.accessSecret, { expiresIn: '15m' });
  }

  verifyAccessToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.accessSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }

  signRefreshToken(userId: string): string {
    return jwt.sign({ userId, jti: randomUUID() }, this.refreshSecret, { expiresIn: '7d' });
  }

  verifyRefreshToken(token: string): { userId: string } {
    const payload = jwt.verify(token, this.refreshSecret) as { userId: string; [key: string]: unknown };
    return { userId: payload.userId };
  }
}
```

`verifyAccessToken`/`verifyRefreshToken` are unaffected — they only ever read `payload.userId`, never the full payload, so an added `jti` field doesn't change their behavior.

Also add direct unit test coverage for this invariant (the integration test only covers it indirectly via cookie-value comparison) — add to `backend/tests/unit/JwtTokenService.test.ts`, a new `describe('token uniqueness (jti)')` block with 2 tests asserting two consecutive `signAccessToken`/`signRefreshToken` calls for the same `userId` produce different tokens (see Task 1's section above for the exact test code). Verify via sabotage: temporarily remove the `jti` claim, confirm both new tests fail; restore it, confirm 11/11 pass in `JwtTokenService.test.ts`.

- [ ] **Step 16: Update CLAUDE.md**

Append: "Task 6 (Phase 2): wired cookie-based auth end-to-end. `POST /auth/register` and `POST /auth/login` now set `access_token`/`refresh_token` httpOnly cookies alongside their unchanged JSON response shapes; new `POST /auth/refresh` (cookie-only, sliding renewal) and `POST /auth/logout` (no auth, always 200, clears both cookies) added. `app.ts` now mounts `cors({ origin: process.env.CORS_ORIGIN, credentials: true })` and `cookieParser()` ahead of routes. Backend `PORT` changed from `3000` to `5000` (frees `3000` for the Phase 3 frontend dev server); new env vars `JWT_REFRESH_SECRET` and `CORS_ORIGIN=http://localhost:3000`. Also fixed a real bug in Task 1's `JwtTokenService` surfaced by this task's own integration tests: signing only `{ userId }` with second-granularity `iat`/`exp` made same-second tokens for one user byte-identical, breaking sliding renewal — fixed with a random `jti` claim, with direct unit test coverage added. Phase 2 backend auth upgrade is feature-complete: `docker compose up -d --build` then register (cookies set) → protected route via cookie jar, no header → refresh (new cookies) → logout (cookies cleared, agent locked out) all work against real Postgres."

- [ ] **Step 17: Commit**

```bash
git add backend/src/presentation/routes/auth.routes.ts backend/src/app.ts backend/src/infrastructure/auth/JwtTokenService.ts backend/.env.example backend/docker-compose.yml backend/tests/setup.ts backend/tests/unit/JwtTokenService.test.ts backend/tests/integration/auth.routes.test.ts backend/tests/integration/cors.test.ts CLAUDE.md
git commit -m "feat: wire cookie-based auth, refresh, logout, and CORS end-to-end"
```

---

## Phase 2 Complete

At this point, the backend implements every requirement in `docs/superpowers/specs/2026-07-13-backend-auth-cookie-design.md`: httpOnly cookie access (15 min) + refresh (7 days, sliding renewal) tokens set on register/login, `POST /auth/refresh` (cookie-only), `POST /auth/logout` (idempotent, always 200), `requireAuth` accepting either the cookie or the existing `Authorization: Bearer` header, and CORS configured for a single explicit frontend origin with credentials — all without any DB-backed session/revocation storage, per the spec's stated non-goals.

**Post-Task-6 hardening from the final whole-branch review:** the review found access/refresh token isolation relied *solely* on `JWT_SECRET != JWT_REFRESH_SECRET` being true, with nothing in code enforcing it — if a deploy config ever set the two secrets equal, a leaked access token could be replayed against `/auth/refresh` indefinitely. Fixed with two changes (both sabotage-verified): `JwtTokenService` now signs a `typ: 'access'`/`typ: 'refresh'` claim and each verify method rejects the wrong `typ`, so token-kind separation doesn't depend solely on secret distinctness (`tests/unit/JwtTokenService.test.ts`, 2 new tests using intentionally identical secrets); `createApp()` throws at startup if the two secrets are equal, failing loudly at boot rather than degrading silently (`tests/unit/app.test.ts`, new file, 2 tests). Final state: 100/100 tests passing, typecheck clean.

Deferred to Phase 3 hardening (noted by the final review, not urgent): no startup validation that `CORS_ORIGIN`/`JWT_SECRET`/`JWT_REFRESH_SECRET` are non-empty (only the equality check was added); the access token also travels in the `/auth/login`/`/auth/refresh` JSON body for header-based callers, which the Phase 3 frontend should ignore in favor of the cookie; refresh-token rotation has no reuse-detection (stateless JWT, explicit non-goal) — revisit if/when a DB-backed session store is ever introduced.

Phase 3 (Next.js frontend consuming this cookie session) needs its own brainstorming session, spec, and plan before implementation — do not start it from this plan.
