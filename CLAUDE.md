# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A cultivation-game (gameplay rebuilt to 100% feature parity with Nhất Niệm Tiêu Dao / 一念逍遥) with a Node/Express backend (`backend/`) and a Next.js frontend (`frontend/`). See `docs/superpowers/specs/` for design docs and `docs/superpowers/plans/` for implementation plans — read the relevant spec before changing game-logic behavior.

## Mandatory Rules

- **Architecture: Clean Architecture.** Backend code is organized into strict layers with dependencies pointing inward only:
  - `domain/` — entities and pure business logic (e.g. linh khí accumulation formula, breakthrough pity/success-rate formula, stage transitions). Zero framework or library dependencies. Defines repository/service interfaces (ports) that outer layers implement.
  - `application/` — use cases that orchestrate domain logic (e.g. RegisterUser, LoginUser, GetCultivationState, AttemptBreakthrough). Depends only on domain interfaces, never on concrete infrastructure.
  - `infrastructure/` — concrete implementations of domain ports: Prisma-backed repositories, JWT token service, bcrypt password hasher, realm config data.
  - `presentation/` — Express routes, controllers, middleware, request validation/DTO mapping. Translates HTTP ↔ use case input/output.
  - A composition root (`src/main.ts` or `app.ts`) wires concrete infrastructure into use cases and controllers.
  - `domain` must never import from `infrastructure` or `presentation`.
- **Comment logic clearly.** Non-trivial business/domain logic (formulas, state transitions, concurrency handling, etc.) must have clear comments explaining the *why* and the mechanics — do not leave complex logic uncommented.
- **Update CLAUDE.md after every task.** When executing an implementation plan, after completing each task, update this file to reflect new architecture, commands, or notes introduced by that task.
- **Use context7 (`ctx7` CLI) before writing library-specific code.** Before using any API from a dependency (Express, Prisma, Next.js, GSAP, jsonwebtoken, zod, etc.), fetch current docs for that library via context7 and cross-check against the exact version pinned in `package.json` — do not rely on training data for library API shape.

## Backend Progress

Task 1: Scaffolded Express+TypeScript backend with Docker Compose dev environment (`api` + `db` services). Commands: `cd backend && docker compose up -d --build`, `npm test`. Health endpoint verified: `GET /health` returns `{"status":"ok"}`.

Task 2: added `User`/`Character` Prisma models (`prisma/schema.prisma`) and the Prisma client singleton (`src/infrastructure/db/prisma.ts`). Run `npx prisma migrate dev --name init` after a fresh clone.

Task 3: added realm/sub-stage config (`src/infrastructure/config/realms.ts`) — 12 realms × 4 substages, literal tunable data, `MAX_REALM_MAJOR` derived from array length.

Task 4: added lazy linh khí accumulation formula (`src/domain/cultivation/cultivation.calc.ts`), pure and framework-free per the Clean Architecture `domain/` rule.

Task 5: added breakthrough pity formula and stage-transition logic (`src/domain/breakthrough/breakthrough.calc.ts`), pure and framework-free.

Task 6: added domain entities (`User`, `Character`), `DomainError`, and ports (`UserRepository`, `CharacterRepository`, `PasswordHasher`, `TokenService`, `RandomSource`) under `src/domain/`.

Task 7: added `RegisterUserUseCase`/`LoginUserUseCase` (`src/application/`), unit-tested against in-memory fakes (`tests/fakes/`) with no database or real crypto involved.

Task 8: added `GetCultivationStateUseCase` (`src/application/`), unit-tested against `InMemoryCharacterRepository` fake — no database needed.

Task 9: added `AttemptBreakthroughUseCase` (`src/application/`) with the optimistic-concurrency guard, unit-tested against `InMemoryCharacterRepository` and `FixedRandomSource` fakes — deterministic success/failure without any real RNG or database.

Task 10: added infrastructure adapters `BcryptPasswordHasher` and `JwtTokenService` (`src/infrastructure/auth/`), and `MathRandomSource` (`src/infrastructure/random/`), each implementing a domain port from Task 6. `BcryptPasswordHasher` and `JwtTokenService` are fully unit-tested; `MathRandomSource` is a pass-through to `Math.random()` exercised indirectly during integration tests.

Task 11: added `PrismaUserRepository`/`PrismaCharacterRepository` (`src/infrastructure/repositories/`), integration-tested against real Postgres. The concurrency guard uses `updateMany({ where: { id, lastUpdateAt } })` + a `count === 0` check.

Task 12: added `errorHandler` Express error-middleware and `createRequireAuth(tokenService: TokenService)` middleware factory (`src/presentation/middleware/`). `errorHandler` is the single source of truth for mapping `DomainError.code` to HTTP status codes (keeps domain/application free of HTTP knowledge). `createRequireAuth` takes a `TokenService` port (not hardcoded to any implementation), so it can be tested with `FakeTokenService` or wired with `JwtTokenService`. Both middleware tested with 3 cases each (errorHandler: known code, unknown code, non-DomainError; requireAuth: missing header, invalid token, valid token + userId attachment). Exports `interface AuthedRequest extends Request { userId?: string }` for use in routes (Tasks 13, 14).

Task 13: wired `POST /auth/register` and `POST /auth/login` end-to-end through the composition root (`src/app.ts`), integration-tested against real Postgres.

Task 14: wired `GET /cultivation/state` and `POST /cultivation/breakthrough` end-to-end. `createApp(overrides?)` now accepts `randomSource` so tests can force breakthrough success/failure deterministically. Phase 1 backend core is feature-complete: `docker compose up -d --build` then register → login → state → breakthrough all work against real Postgres. Also fixed two environment issues found during this task's mandatory Docker Compose verification step: (1) `node:20-alpine`'s current base ships OpenSSL 3 only, so Prisma's engine needs `openssl` installed in the image (`Dockerfile`) and an explicit `linux-musl-openssl-3.0.x` binary target (`prisma/schema.prisma`) alongside `native`, or the containerized API fails to load its query engine; (2) the concurrent-breakthrough integration test pre-warms two Prisma connections before racing two requests, since a cold connection pool made the race non-deterministic (the loser's first read paid a one-time connection-open cost, so it read *after* the winner had already committed and got 400 instead of racing into 409 — confirmed by running 15x with/without the pre-warm: 13/15 failures without it, 0/15 with it).

## Phase 2: Backend Auth Cookie Upgrade

Task 1: extended `TokenService` port with `signRefreshToken`/`verifyRefreshToken`; `JwtTokenService` now takes two secrets (`accessSecret`, `refreshSecret`) and signs access tokens with a 15-minute expiry (down from Phase 1's 7 days) and refresh tokens with a 7-day expiry. `FakeTokenService`'s token-string prefixes changed to `access-token-for-`/`refresh-token-for-` to distinguish token kinds the same way the real service's two secrets do. This breaks `tests/unit/LoginUserUseCase.test.ts`'s hardcoded literal (fixed in Task 3) — `tests/unit/auth.middleware.test.ts` turned out to already be prefix-agnostic (it round-trips via `signAccessToken`, never hardcodes the literal), so it was unaffected by this change despite the original plan expecting it to break too; Task 5 still updates that file for the cookie-fallback feature itself.

Task 2: added `cookie-parser`/`cors` dependencies (`package.json`) and `presentation/cookies.ts` (`setAuthCookies`/`clearAuthCookies`), centralizing cookie attributes (httpOnly, sameSite=lax, path=/) so all 4 auth call sites (register/login/refresh/logout) stay in sync. Access token max-age is 15 minutes, refresh token max-age is 7 days; `clearAuthCookies` explicitly passes `path: '/'` to Express's `clearCookie` so the browser recognizes it as the same cookie and actually deletes it (not auto-matched). Unit-tested with 3 tests (httpOnly/path/sameSite attributes, max-age values, clear behavior).
