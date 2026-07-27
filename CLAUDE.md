# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A cultivation-game (gameplay rebuilt to 100% feature parity with Nhất Niệm Tiêu Dao / 一念逍遥) with a Node/Express backend (`backend/`) and a Next.js frontend (`frontend/`). See `docs/superpowers/specs/` for design docs and `docs/superpowers/plans/` for implementation plans — read the relevant spec before changing game-logic behavior.
Contributor workflows are summarized in the root `AGENTS.md`; keep that guide aligned with the commands and architecture below.

## Mandatory Rules

- **Architecture: Clean Architecture.** Backend code is organized into strict layers with dependencies pointing inward only:
  - `domain/` — entities and pure business logic (e.g. linh khí accumulation formula, breakthrough pity/success-rate formula, stage transitions). Zero framework or library dependencies. Defines repository/service interfaces (ports) that outer layers implement.
  - `application/` — use cases that orchestrate domain logic (e.g. RegisterUser, LoginUser, GetCultivationState, AttemptBreakthrough). Depends only on domain interfaces, never on concrete infrastructure.
  - `infrastructure/` — concrete implementations of domain ports: Prisma-backed repositories, JWT token service, bcrypt password hasher, realm config data.
  - `presentation/` — Express routes, controllers, middleware, request validation/DTO mapping. Translates HTTP ↔ use case input/output.
  - A composition root (`src/main.ts` or `app.ts`) wires concrete infrastructure into use cases and controllers.
  - `domain` must never import from `infrastructure` or `presentation`.
- **Comment logic clearly.** Non-trivial business/domain logic (formulas, state transitions, concurrency handling, etc.) must have clear comments explaining the *why* and the mechanics — do not leave complex logic uncommented.
- **Update CLAUDE.md after every task — core facts only.** When executing an implementation plan, after completing each task, update this file to reflect new architecture, commands, or notes introduced by that task. Keep entries **concise and current-state-only**: record file paths, patterns, error codes, gotchas, and the latest test counts — NOT per-task narratives, intermediate test counts, fixed-bug stories, or verification walkthroughs. When a later change supersedes an entry, rewrite it in place instead of appending. Detailed history belongs in the spec/plan docs and git log, not here.
- **Use context7 (`ctx7` CLI) before writing library-specific code.** Before using any API from a dependency (Express, Prisma, Next.js, GSAP, jsonwebtoken, zod, etc.), fetch current docs for that library via context7 and cross-check against the exact version pinned in `package.json` — do not rely on training data for library API shape.

## Commands & Environment

- Backend: `cd backend && docker compose up -d --build` (api on `:5000` + Postgres), `npm test` (unit + integration vs real Postgres), `npm run db:seed`. After fresh clone: `npx prisma migrate dev`.
- Frontend: `cd frontend && pnpm dev` (`:3000`), `pnpm test` (Vitest), `pnpm lint`/`pnpm format` (Biome), `pnpm build`. Needs network at build/dev (`next/font/google`) and the backend running for auth/dashboard checks. Gate = lint + tsc + tests + build.
- Backend env: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN=http://localhost:3000`, `PORT=5000`. Frontend: `NEXT_PUBLIC_API_BASE=http://localhost:5000` in `frontend/.env.local`.
- Docker/Prisma gotcha: `node:20-alpine` needs `openssl` in the image + `linux-musl-openssl-3.0.x` binary target in `prisma/schema.prisma`, or the query engine fails to load.
- Integration-test gotchas: pre-warm Prisma connections before racing concurrent requests (cold pool makes races non-deterministic); usernames must satisfy `registerSchema` `min(3)`.
- Current test counts: **backend 410, frontend 108**.

## Backend: Phase 1 (core) + Phase 2 (cookie auth)

- Phase 1 built the core: Prisma models (`User`, `Character`), pure domain calcs (`domain/cultivation/cultivation.calc.ts` lazy linh khí accrual, `domain/breakthrough/breakthrough.calc.ts` pity/success-rate + stage transitions), domain ports + entities, use cases (`RegisterUser`, `LoginUser`, `GetCultivationState`, `AttemptBreakthrough`), infra adapters (`BcryptPasswordHasher`, `JwtTokenService`, `MathRandomSource`, Prisma repos), middleware (`errorHandler` = single source of DomainError→HTTP mapping; `createRequireAuth(tokenService)`), routes wired in `app.ts` (`createApp(overrides?)` accepts `randomSource` for deterministic breakthrough tests).
- **Optimistic concurrency pattern** (used throughout): `updateMany({ where: { id, lastUpdateAt } })` + `count === 0` → `CONCURRENT_MODIFICATION`.
- Phase 2 added cookie auth: access token 15min + refresh token 7d, both as httpOnly cookies (`sameSite=lax, path=/`, centralized in `presentation/cookies.ts`); `POST /auth/refresh` (sliding renewal — brand-new refresh each time) and `POST /auth/logout`. `requireAuth` prefers the cookie, falls back to `Authorization: Bearer`. `JWT_SECRET` keeps its Phase 1 name; `JWT_REFRESH_SECRET` is the added one.
- `JwtTokenService` details: two secrets, random `jti` claim on every token (otherwise same-second tokens are byte-identical), `typ: 'access'|'refresh'` claim enforced by both verifiers, `{ algorithms: ['HS256'] }` pinning. `createApp()` throws at boot if `JWT_SECRET === JWT_REFRESH_SECRET` or if `CORS_ORIGIN` is unset.

## Frontend (Phase 3)

- Next.js 16 App Router, React 19, Tailwind 4, GSAP 3.15 + @gsap/react, Biome, Vitest. Cookie auth with silent 401→refresh→retry in `lib/api.ts` (`credentials: "include"` + `isRefreshing` single-shot guard; unrecoverable 401 → "Authentication expired" → `/login` redirect in `use-cultivation-state`).
- Layering: `src/lib/` (framework-light: types, format, realm-constants, api, auth-context), `src/hooks/`, `src/components/` (presentational + GSAP), `src/app/`.
- Testing: pure-logic unit tests only (`environment: "node"`, `include: ["src/**/*.test.ts"]`); animated components verified by human observation. Biome a11y rules are on (recommended next/react) — overlay backdrops must be accessible `<button>`s, not clickable `<div>`s.

## Đan Dược (pills) — backend + integration

- Schema: `Pill` table (definitions in DB, seeded by `prisma/seed.ts`; **8 pills**), `InventoryItem` (`@@unique([userId, pillId])`), `Character.cultivationBuffMultiplier/cultivationBuffUntil` (timed buff) + `breakthroughBonusPct` (one-shot boost). `Pill.active` (soft-disable, never hard-delete) + `Pill.starterQuantity` (new-player grant; **currently 0 for all pills** — `seedStarterInventory` filters `active AND starterQuantity > 0` so new users get nothing; admins re-grant via `PUT /admin/pills/:id`).
- Domain: `domain/pills/` (`PillRecord`, `PillEffectKind`, pure `pill.calc.ts applyPillEffect` — buff/boost refresh/replace, never stack; pure `pill.validate.ts` per-effectKind rules → `INVALID_PILL_CONFIG`). `computeLinhKhi` has optional `buff` param, integrated **piecewise** (buffed segment `[lastUpdateAt, min(now, until)]` at `rate × multiplier`). `computeSuccessRate` has optional `bonusPct` added before max clamp.
- `ConsumePillUseCase`: guards → recompute → **`decrementOne` FIRST** (atomic `updateMany … quantity > 0`) → apply → optimistic persist; compensates with `incrementOne` on a lost race (saga pattern, deliberately no cross-repo transaction in application layer). Inactive pills rejected as `PILL_NOT_FOUND` before decrement. `AttemptBreakthroughUseCase` uses buffed accrual + bonus, resets `breakthroughBonusPct` on any *resolved* attempt. `GetCultivationStateUseCase` also passes the buff (read path) so polled state reflects it.
- Routes: `GET /pills/inventory`, `POST /pills/consume`; admin CRUD `GET/POST /admin/pills`, `PUT /admin/pills/:id` (id slug `^[a-z0-9-]+$`, body has no id on update). Errors: `PILL_NOT_FOUND` 404, `PILL_OUT_OF_STOCK` 409, `PILL_NOT_APPLICABLE` 400, `INVALID_PILL_CONFIG` 400, `PILL_ID_TAKEN` 409.
- Frontend: server-authoritative. `useCultivationState` owns buff/boost truth (countdown + badge from polled state); `usePillInventory(enabled)` lazy-fetches on modal open, `consume()` POSTs then refetches in `finally` (error paths re-sync too). `handleUsePill` is wait-for-server (await POST + refetch, then particles/toast; server error message as danger toast). `lib/cultivation-display.ts` (`effectiveCultivationRate`, `interpolateLinhKhi`) mirrors the backend's piecewise accrual so the stats panel and bar show buffed rates. `pill-constants.ts` keeps only `RARITY_META`/`getRarityMeta`.
- Gotcha: `db:seed` upserts full pill rows — it **overwrites admin edits**; treat it as a reset tool, never routine.

## Realms: 5 sub-stages + config in DB + admin API

- Sub-stages: `Sơ Kỳ, Trung Kỳ, Hậu Kỳ, Đại Thành, Viên Mãn` (index 0–4; peak 4), resampled from old 4-point curves (`i·3/4` interpolation, endpoints exact). No DB migration needed for `realmSub` (unconstrained Int).
- Realm tuning lives in the `RealmStage` table (`@@unique([realmMajor, realmSub])`, 60 rows seeded from `SEED_REALMS`), runtime-editable. `domain/config/realms.ts` holds pure types + `SEED_REALMS` + `RealmConfigSet` value object (`getStage`, `realmName`, `maxRealmMajor`, `peakRealmSub(major)`, `clampStage`). Port `RealmConfigSource { get(): RealmConfigSet }` (sync); `RealmConfigProvider` (composition-root cache: `ensureLoaded`/`get`/`reload`), gated by middleware after `/health`.
- The three cultivation use cases take `RealmConfigSource`. `GetCultivationStateUseCase` **lazy-clamps** out-of-range `(realmMajor, realmSub)` and persists (fixes the old 500). `UpdateRealmConfigUseCase` validates: ≥1 realm, ≥1 sub-stage each, `linhKhiRequired` strictly increasing **within each realm only** (balance resets lower across realm boundaries) → `INVALID_REALM_CONFIG` 400.
- `User.role` (`"user"` default): `signAccessToken(userId, role)`, `requireAdmin` middleware → `FORBIDDEN` 403. `GET/PUT /admin/realms` behind both middlewares; PUT = full replace (`$transaction([deleteMany, createMany])`) then `provider.reload()` (live immediately). **Admin bootstrap:** `UPDATE "User" SET role='admin' WHERE username='<name>';` then re-login. `RefreshAccessTokenUseCase` re-reads the user so promotions apply at next refresh.

## Admin dashboard (frontend)

- `/admin` inside the Next.js app, sidebar-rail **pro-dashboard** register (flat `.admin-panel`s, `--font-mono`/`.admin-num` for numerics, gold accents; rail collapses to top strip ≤768px). `admin/layout.tsx` = client-side guard (UX only — real enforcement is backend).
- **Cả bốn trang CRUD dùng chung một bộ khung trung tính** trong `globals.css`: `.admin-master-detail` (lưới 2 cột) · `.admin-master-list`/`-item`/`-empty` (thẻ rời cuộn được) · `.admin-status--ok|warn|danger|off` · `.admin-detail` (viền trên lấy màu từ `--detail-tone`) · `.admin-form` + `-section*` + `.admin-field*` + `.admin-switch*` + `.admin-form-footer` · `.admin-row*`. Tên lớp mang nghĩa miền chỉ còn `.admin-code-string`, `.admin-code-reward-kind|qty*`.
- Gauge: redeem code = lượt đã đổi (`.admin-pips`/`.admin-meter`), đan dược + công pháp = 5 pip độ hiếm (`RarityPips`, `rarityPipCount`), cảnh giới = đường cong linh khí thang log (`RealmCurve`, `curveHeights`). `/admin/realms` sửa một tiểu cảnh giới qua tab (`.admin-tabs`/`.admin-tab`), có chấm lỗi `.admin-err-dot`; 12 ô số chia 3 section.
- Quy ước nhãn: `/admin/codes` đánh dấu `*`; ba trang kia để ô bắt buộc trơn và ghi `(tùy chọn)` trong hint cho ô tùy chọn.
- Backend: `GET /auth/me` (`requireAuth`, role from the **verified token**, not DB — mirrors what `requireAdmin` enforces this session), `GET /admin/stats` (`StatsRepository` port + `GetAdminStatsUseCase`; realm deleted from config labeled `"Realm #N"`).
- Frontend: `auth-context` probes `/auth/me` on mount, exposes `me`; `HeaderMenu` shows "Quản trị" when `me.role === "admin"`. Pure validation mirrors: `lib/realm-validation.ts`, `lib/pill-validation.ts`, `lib/redeem-validation.ts` (pre-flight field errors; NaN from empty numeric input blocks Save). Draft editors disable all mutating controls while saving; index-keyed UI state is remapped on remove.
- `HeaderMenu` owns header actions: desktop inline / mobile hamburger (pure CSS media query, SSR-safe), Escape/outside-click close, full ARIA. Items: Đan Phòng, Nhập Code, Quản trị (admin), Đăng xuất.

## Redeem codes

- Schema: `RedeemCode` (code unique, active, maxRedemptions, redeemedCount, expiresAt), `RedeemCodeReward` (multi-kind: nullable `pillId`/`congPhapId`/`linhThach`, exactly one set — no `@@unique` since nullable-unique semantics differ per DB), `Redemption` (`@@unique([codeId, userId])`, cascade on user+code).
- `tryReserveRedemption` (atomic): insert `Redemption` first (P2002 → already_redeemed), then conditional `updateMany` increment under cap — `count === 0` → delete the redemption (saga compensation) → exhausted. Reserve BEFORE grant.
- `normalizeCode` (trim+uppercase) is the single case-insensitivity source for create and lookup. Player route `POST /redeem`; admin `GET/POST/PUT /admin/codes` (`redeemedCount`/`code` immutable). Disabled-pill rewards are still granted (code's promise wins); hard-deleted pill falls back to id in the toast. 7 error codes mapped in `errorHandler` (404 not-found; 400 inactive/expired/invalid; 409 already-used/exhausted/taken).
- Reward result shape is `{ kind: 'pill'|'congphap'|'linhThach', id, name, glyph, quantity }` (was `{ pillId, … }`). `validateRedeemCodeDefinition` enforces exactly-one-kind per reward and dedupes per kind (`pill:x` ≠ `congphap:x`). `PrismaRedeemCodeRepository.grantRewards` only touches inventory for `pillId` rewards; công pháp/Linh Thạch are granted by the use case.
- Frontend: `RedeemModal` (GSAP, from HeaderMenu; success = particle burst + toast + cultivation refetch). `/admin/codes` chọn loại thưởng cho từng dòng — đổi loại thì **thay cả dòng** (`emptyRewardOfKind`) để không sót khóa cũ làm hỏng rule "đúng một loại".

## Công Pháp & Thuộc tính

- **6 thuộc tính** (khóa dùng nguyên văn): `khiHuyet, chanNguyen, congVatLy, congPhep, phongThu, tocDo` (`domain/attributes/`). Chiến lực = tổng trọng số `BATTLE_POWER_WEIGHTS` trên thuộc tính *final*, làm tròn; công pháp chủ động **không** tham gia.
- Công thức gộp: `final = (base + Σ flat×level) × (1 + Σ pct×level/100)` — cộng phẳng TRƯỚC, nhân % SAU.
- Base theo sub-stage nằm ở 6 cột `RealmStage.base*` (admin sửa qua `PUT /admin/realms`, schema `.default(0)` nên body client cũ vẫn hợp lệ). `SEED_REALMS = SEED_REALMS_CORE + deriveBaseAttributes(cultivationRate)` — literal core giữ gọn, base sinh tự động. `RealmConfigSet.baseAttributes(major, sub)`.
- `CongPhap` (định nghĩa trong DB, `effects` là Json cho passive) + `OwnedCongPhap` (`@@unique([userId, congPhapId])`, `level`, `equippedSlot`) + `Character.linhThach`. Bị động cộng thuộc tính; chủ động chiếm 1 trong `ACTIVE_SLOTS`=4 slot và **chưa** áp dụng hiệu ứng (để dành phase combat). Soft-disable bằng `active`, không hard-delete.
- `levelUpCost = round(baseCost · costGrowth^(level−1))` (level 1→2 = baseCost). `LevelUpCongPhapUseCase` dùng saga giống `ConsumePill`: `spendLinhThach` (atomic guard `linhThach >= amount`) TRƯỚC, rồi `levelUpGuarded` (guard trên level cũ); thua race → `addLinhThach` hoàn lại.
- Redeem trùng công pháp → quy đổi `duplicateRefund = dupRefundLinhThach ?? baseCost` thành Linh Thạch.
- `buildAttributeState` (application) dùng chung cho các use case trả cultivation state; chỉ passive **và** `def.active` mới đóng góp. `GET /cultivation/state` trả thêm `linhThach`, `attributes.{base,final}`, `battlePower`. `POST /cultivation/breakthrough` vẫn trả `{ success, character }` (character mang `linhThach`, không mang attributes).
- Routes: `GET /congphap`, `POST /congphap/equip|unequip|levelup`; admin `GET/POST /admin/congphap`, `PUT /admin/congphap/:id`, `POST /admin/grant` (cấp công pháp và/hoặc Linh Thạch), `GET /admin/users?q=&limit=` (tìm người chơi cho ô cấp thưởng; `SearchUsersUseCase` clamp limit vào [1,50], mặc định 20).
- Mã lỗi: `CONGPHAP_NOT_FOUND` 404 · `CONGPHAP_NOT_OWNED` 404 · `CONGPHAP_NOT_EQUIPPABLE` 400 · `CONGPHAP_SLOT_INVALID` 400 · `CONGPHAP_MAX_LEVEL` 409 · `INSUFFICIENT_LINH_THACH` 409 · `INVALID_CONGPHAP_CONFIG` 400 · `CONGPHAP_ID_TAKEN` 409 · `INVALID_GRANT` 400.
- Frontend: `AttributePanel` — panel riêng ở cột trái, dùng chung khuôn `.panel`/`.panel-title`/`.stat-row` với `StatsPanel` (Tu Hành Bảng): Chiến lực + Linh Thạch + 6 thuộc tính (hiện `final`, hậu tố vàng `(+N)` = chênh so với `base`). Modal Công Pháp (`CongPhapModal`, mở từ `HeaderMenu`): 4 ô chủ động + danh sách bị động + "chưa sở hữu"; `useCongPhap(enabled)` lazy-fetch, mọi mutation `try/finally refetch` rồi `refetch()` cultivation state (wait-for-server như `handleUsePill`). Thư viện thuần: `attribute-constants.ts`, `congphap-display.ts` (mirror `levelUpCost`/bonus/`attributeDelta`), `congphap-validation.ts`.
- **`getCongPhapRarityMeta` clamp rarity về 0–4** trước khi tra `RARITY_META`: `CongPhap.rarity` là `Int` không chặn khoảng (khác `Pill`), admin đặt 7 sẽ ra `undefined.color` nếu tra thẳng.
- Admin: `/admin/congphap` (master/detail như `/admin/pills`; form đổi theo `category`, editor `effects[]`, preview chi phí) + khối **Cấp thưởng** (search user debounce 300ms → `POST /admin/grant`). `/admin/realms` có thêm 6 ô base thuộc tính. `/admin/codes` chọn được loại thưởng (đan dược / công pháp / Linh Thạch).
- Gotcha: `db:seed` upsert cả `CongPhap` (3 mẫu) — đè chỉnh sửa admin, dùng như công cụ reset.
- Prisma gotcha: cột `Json?` phải set `Prisma.DbNull` để xóa giá trị khi update — bỏ trống key nghĩa là "không đổi", nên passive→active sẽ còn sót `effects` cũ.

## Bí cảnh, nguyên liệu và luyện đan (schema/catalog)

- Prisma schema đã có `Material`/`MaterialInventory`, `AlchemyRecipe`/`AlchemyJob`, `ExpeditionBranch`/`ExpeditionDifficulty`/`ExpeditionUpgradeMaterialWeight`, `ExpeditionDailyQuota` và `Expedition`; `CongPhap` có thêm cấu hình material nâng cấp và cooldown.
- Catalog seed idempotent trong `backend/prisma/seed.ts`: 11 material, 8 recipe (16 ingredient rows), 8 branch, 24 difficulty và 24 weight rows. Seed là công cụ reset, có thể ghi đè chỉnh sửa catalog.
- `CongPhapRecord` và Prisma mappers giữ `upgradeMaterialId`, `baseMaterialCost`, `materialCostGrowth`, `cooldownRounds`; migration `bi_canh_materials_alchemy_expedition` đã áp dụng.
- Domain materials/alchemy: `ticketCostForDuration` dùng 1/2/4 units cho 30m/2h/8h, quota ngày là 12 units; `materialCostAtLevel` và `canSpendMaterials` là pure helpers. `settleAlchemyQueue` resolve job hoàn tất offline và chỉ tạo output grant một lần.
- API hiện tại: `GET /materials/inventory`, `GET /alchemy/recipes`, `GET /alchemy/queue`, `POST /alchemy/queue`; route lấy user từ `requireAuth`. Prisma repositories giữ spend material + Linh Thạch và output Pill trong transaction.
- Admin catalog API: `GET/PUT /admin/materials`, `GET/PUT /admin/alchemy/recipes`, `GET/PUT /admin/expeditions`; full-replace transaction, validate duplicate/foreign/config rows trước khi ghi, chỉ admin được gọi. Material rows không xóa material đã tham chiếu bởi inventory.
- Level-up công pháp dùng `ProgressionRepository.levelUpWithCosts`: guard Linh Thạch, material và expected level trong một transaction serializable; kết quả race/thiếu từng resource được phân biệt, response có `material` balance.
- Combat domain: `simulateBattle` là turn-based deterministic, thứ tự theo `tocDo`, skill theo slot/cooldown/Chân Nguyên; `SeededRandom` dùng integer seed, không gọi `Math.random()` trong domain.
- Expedition domain/API: `simulateExpedition` chạy 2 normal + 1 boss, snapshot seed/reward trước claim; repository giữ quota 12 units/ngày, active/completed slot và claim idempotent. Routes: `GET /expeditions/branches`, `GET /expeditions/current`, `POST /expeditions/start`, `POST /expeditions/claim`.
- Frontend data layer: `useExpedition`, `useMaterialInventory`, `useAlchemyQueue` lazy-load server state and refetch after mutations; `lib/expedition-display.ts` formats duration/ticket cost/reward percentage and clamps countdowns.
- Frontend UI: `ExpeditionCard`/`ExpeditionDrawer` và `AlchemyCard`/`AlchemyDrawer` dùng server-authoritative mutations, local countdown, accessible backdrop/Escape và responsive layout; page refetches cultivation/material balances after claim/enqueue.
- Công Pháp frontend: `CongPhapDTO` carries material upgrade config; `CongPhapCard` shows Linh Thạch + material balance and disables level-up when either is insufficient. Level-up refetches material inventory and cultivation state; `LevelUpResult.material` carries the committed balance.
- Backend gate hiện tại: **410 tests**, frontend **114 tests**, backend `npm run build`, frontend lint/typecheck/build pass. Integration cần `backend/.env` với PostgreSQL chạy ở `localhost:5432`.

## Security hardening (backend)

- Rate limit: `authRateLimiter` (express-rate-limit v8, 20 req/IP/15min) on `POST /auth/register|login|refresh` only; skipped when `NODE_ENV==='test'`; 429 uses the shared `{ error: { code, message } }` shape. Not behind a proxy (no `trust proxy`).
- Refresh-token revocation: `User.tokenVersion` embedded in refresh tokens; `RefreshAccessTokenUseCase` rejects version mismatch; `LogoutUseCase` (behind `/auth/logout`) bumps `tokenVersion` when the cookie is valid → logout-everywhere; still idempotent/always-200. Legacy tokens (no claim) default to 0. Per-session revocation (jti denylist) intentionally not done.
- `helmet@^8` mounted first in `createApp()`; boot rejects default dev secrets when `NODE_ENV==='production'`; `bcrypt@^6` (clears node-tar advisories — `npm audit --omit=dev` = 0; remaining audit findings are dev-only vite/vitest).
- Migrations: `User` delete cascades to `Character` + `InventoryItem` (`onDelete: Cascade`; DB-level only, no delete endpoint).

## Frontend presentational notes

- Stats panel shows "Tỷ lệ đột phá" from `CultivationStateOutput.breakthroughSuccessRate` (backend-computed via the same `computeSuccessRate` an attempt uses; gold `(+N%)` while boost pending; hidden at max stage).
- Admin area was redesigned twice (cosmic/glass → pro-dashboard); both were CSS/JSX-only with zero logic changes. `/admin/codes` form uses dedicated `.admin-code-form` sections (not the pill grid), custom checkbox-driven switch (no `role="switch"` — Biome).
- Visual/animation parity across 375/768/1024/1440px is always a human-observation gate, never automated.
