# Repository Guidelines

## Project Structure & Module Organization

The game is split into two TypeScript applications:

- `backend/` contains the Express API, Prisma schema/migrations/seed data, and tests. Its `src/` follows Clean Architecture: `domain/` holds framework-free rules, `application/` use cases, `infrastructure/` adapters, and `presentation/` HTTP concerns. Tests live in `backend/tests/unit/` and `backend/tests/integration/`.
- `frontend/src/` contains the Next.js App Router under `app/`, reusable UI in `components/`, stateful data hooks in `hooks/`, and framework-light helpers/API code in `lib/`.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` contain approved behavior specs and implementation plans. Read the relevant spec before changing game logic.

## Build, Test, and Development Commands

Run commands from the indicated application directory:

```bash
cd backend && docker compose up -d --build  # API :5000 + PostgreSQL
cd backend && npm test                      # Unit and integration tests
cd backend && npm run build                 # Prisma generate + TypeScript build
cd backend && npm run db:seed                # Reset/seed catalog data
cd frontend && pnpm dev                      # Next.js :3000
cd frontend && pnpm test                    # Vitest logic tests
cd frontend && pnpm lint                    # Biome checks
cd frontend && pnpm exec tsc --noEmit       # Type-check
cd frontend && pnpm build                   # Production build
```

For a fresh database, run `cd backend && npx prisma migrate dev`. Set backend secrets/CORS and `NEXT_PUBLIC_API_BASE` in `frontend/.env.local` for auth or dashboard checks.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, and each package's existing quote/import style. Prefer `PascalCase` classes/use cases, `camelCase` functions/variables, and descriptive kebab-case frontend filenames such as `use-cultivation-state.ts`. Keep domain dependencies framework-free; comment non-obvious formulas, state transitions, and concurrency handling. Run Biome before frontend submissions.

## Testing Guidelines

Backend tests use Vitest; integration tests require local PostgreSQL and preserve the existing sequential database assumptions. Frontend tests are `src/**/*.test.ts` and focus on pure logic; verify animated/responsive UI manually. Add or update tests with behavior changes, then run the relevant package test command.

## Commit & Pull Request Guidelines

Use concise Conventional Commit-style prefixes from history, such as `feat:`, `fix:`, and `docs:`. PRs should explain the behavior and affected package, link an issue/spec, list validation commands, and call out migrations or environment changes. Include screenshots or recordings for visual changes.

## Security & Configuration Tips

Never commit `.env` files, database credentials, or JWT secrets. Keep production secrets distinct, and treat `db:seed` as catalog reset tooling because it can overwrite seeded definitions.
