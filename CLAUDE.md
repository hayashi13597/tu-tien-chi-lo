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
