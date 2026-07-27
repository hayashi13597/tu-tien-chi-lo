# Admin Catalog UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bổ sung dashboard admin để chỉnh nguyên liệu, công thức luyện đan và cấu hình bí cảnh qua các API catalog đã có.

**Architecture:** Giữ editor full-replace server-authoritative như `/admin/realms`: mỗi trang tải bản ghi về, sửa draft cục bộ, validate trước khi PUT, rồi đồng bộ lại từ response. Dùng master/detail và các lớp CSS admin hiện có; không thêm backend schema hay repository. Material/recipe/branch được upsert ở backend nên UI cho phép thêm và soft-disable, không giả vờ hỗ trợ xóa vật lý.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Vitest, Biome, existing `apiFetch` and admin CSS tokens.

---

### Task 1: Client validation cho ba catalog

**Files:**
- Create: `frontend/src/lib/admin-catalog-validation.ts`
- Test: `frontend/src/lib/admin-catalog-validation.test.ts`

- [ ] **Step 1: Viết failing tests**

Cover these behaviors with pure Vitest tests:

```ts
expect(validateMaterialCatalog([{ ...material, id: "bad id" }])).toContainEqual(expect.objectContaining({ path: "0.id" }));
expect(validateAlchemyRecipes([{ ...recipe, ingredients: [{ materialId: "m", quantity: 0 }] }])).toContainEqual(expect.objectContaining({ path: "0.ingredients.0.quantity" }));
expect(validateExpeditionConfig([{ ...branch, difficulties: branch.difficulties.filter((d) => d.key !== "hard") }])).toContainEqual(expect.objectContaining({ path: "0.difficulties" }));
```

Also cover duplicate IDs, blank required text, NaN/negative numeric values, duplicate recipe output pills, duplicate ingredient/weight material IDs, and valid catalog drafts returning no errors.

- [ ] **Step 2: Run the new test and confirm RED**

Run `cd frontend && rtk npm test -- src/lib/admin-catalog-validation.test.ts`.
Expected: FAIL because the validation module and functions do not exist.

- [ ] **Step 3: Implement the minimal validators**

Export one `AdminCatalogDraftError` shape `{ path: string; message: string }`, three validators, and `findAdminCatalogError(errors, path)`. Mirror the backend zod/domain constraints: kebab-case IDs, non-empty labels, material rarity ≥ 0, recipe duration/cost/quantities integer ranges, and exactly `easy`/`normal`/`hard` difficulties with rates in `[0, 1]`.

- [ ] **Step 4: Run the tests and confirm GREEN**

Run `cd frontend && rtk npm test -- src/lib/admin-catalog-validation.test.ts`.
Expected: all new tests pass.

### Task 2: Admin catalog API client

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Add failing API contract tests**

Extend the existing API fetch tests to assert:

```ts
await fetchAdminMaterials();
expect(requestUrl).toContain("/admin/materials");
await updateAdminAlchemyRecipes([recipe]);
expect(requestInit.method).toBe("PUT");
expect(JSON.parse(String(requestInit.body))).toEqual({ recipes: [recipe] });
```

Cover GET/PUT for materials, alchemy recipes, and expeditions.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run `cd frontend && rtk npm test -- src/lib/api.test.ts`.
Expected: TypeScript/test failure because the six API functions do not exist.

- [ ] **Step 3: Implement the six typed functions**

Add `fetchAdminMaterials`, `updateAdminMaterials`, `fetchAdminAlchemyRecipes`, `updateAdminAlchemyRecipes`, `fetchAdminExpeditions`, and `updateAdminExpeditions`, using existing DTOs and `apiFetch`, with full-replace bodies `{ materials }`, `{ recipes }`, and `{ branches }`.

- [ ] **Step 4: Run focused tests and typecheck**

Run `cd frontend && rtk npm test -- src/lib/api.test.ts && rtk npx tsc --noEmit`.
Expected: tests pass and no type errors.

### Task 3: Materials admin editor

**Files:**
- Create: `frontend/src/app/admin/materials/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Add the page shell and load/error states**

Load `GET /admin/materials`, preserve `server` and `draft` copies, redirect on `Authentication expired`, and show retry/error states consistent with `/admin/realms`.

- [ ] **Step 2: Add master/detail draft editing**

Render list rows with glyph/name/status/rarity pips. Add a new material draft with a kebab-case ID placeholder. Detail form edits ID (read-only for existing rows), name, glyph, rarity, description, and active switch. Use immutable draft updates and `beforeunload` while dirty.

- [ ] **Step 3: Add save/undo behavior**

Disable save on validation errors or while saving. PUT the entire draft, resync both copies from the server response, keep the draft on server failure, and expose “Lưu tất cả”/“Hoàn tác”. Do not add physical delete; inactive rows remain recoverable and referenced rows remain safe.

- [ ] **Step 4: Add the navigation link**

Add `/admin/materials` to the admin rail using an existing icon and keep `aria-current` behavior consistent with other links.

### Task 4: Alchemy recipe admin editor

**Files:**
- Create: `frontend/src/app/admin/alchemy/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Load recipe dependencies**

Fetch admin recipes, admin pills, and admin materials in parallel. Use the catalog names/glyphs in select options; preserve IDs in the submitted DTOs.

- [ ] **Step 2: Add recipe draft editing**

Render recipe master rows with output pill, active status, duration, and ingredient count. Detail form edits ID, output pill, duration, Linh Thạch cost, active switch, and a repeatable ingredient list with material select, quantity, add, and remove controls. Add a new recipe with the first available pill/material when dependencies exist.

- [ ] **Step 3: Add validation/save/undo flow**

Use `validateAlchemyRecipes` and keep server errors in the page. Save the complete recipe array through the PUT API, resync on success, preserve drafts on failure, and warn before reload with unsaved edits. Explain that removing a row is not supported by the current upsert API; inactive recipes are the disable mechanism.

- [ ] **Step 4: Add navigation and empty dependency states**

Add `/admin/alchemy` to the rail. If no pills/materials exist, show an actionable message and disable creating recipes instead of submitting invalid IDs.

### Task 5: Expedition configuration admin editor

**Files:**
- Create: `frontend/src/app/admin/expeditions/page.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Load branch config and material catalog**

Fetch `GET /admin/expeditions` and `GET /admin/materials` in parallel; show branch names and material labels while retaining IDs.

- [ ] **Step 2: Add branch identity and drop configuration**

Render branch master rows with glyph/name/base power and three difficulty count. Detail form edits immutable ID for existing branches, name, glyph, description, base power, alchemy output material, and repeatable upgrade-material weights.

- [ ] **Step 3: Add difficulty tabs and validation**

Provide tabs for `easy`, `normal`, and `hard`; edit enemy multiplier, normal/boss drop rates, reward multiplier, and adaptive coefficient. Add new branches with all three valid default difficulties. Use `validateExpeditionConfig`, save the full branches array, resync on success, preserve failed drafts, and warn on reload.

- [ ] **Step 4: Add navigation and unsupported-operation messaging**

Add `/admin/expeditions` to the rail. Do not expose duration/ticket edits because those are domain constants, and do not expose physical delete because the backend catalog repository currently preserves existing rows.

### Task 6: Styling and verification

**Files:**
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/lib/admin-catalog-validation.test.ts`, `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Add only catalog-specific styles**

Reuse `.admin-master-detail`, `.admin-form`, `.admin-row-list`, `.admin-row`, `.admin-tabs`, and `.admin-form-footer`. Add small namespaced rules only for long descriptions, weight/ingredient rows, and mobile field stacking; keep existing admin pages visually unchanged.

- [ ] **Step 2: Run focused tests and gates**

Run:

```bash
cd frontend
rtk npm test -- src/lib/admin-catalog-validation.test.ts src/lib/api.test.ts
rtk npm run lint
rtk npx tsc --noEmit
rtk npm run build
```

Expected: all tests pass, Biome is clean, typecheck succeeds, and the production build completes.

- [ ] **Step 3: Review diff and preserve unrelated work**

Run `rtk git diff --check` and `rtk git status --short`; verify only the new catalog UI/API/validation/plan files are part of this change and `CLAUDE.md`/`AGENTS.md` user changes remain untouched.
