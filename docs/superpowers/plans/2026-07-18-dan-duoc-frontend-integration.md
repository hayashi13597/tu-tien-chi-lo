# Đan Dược Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the đan dược frontend mock with the real backend API — inventory and buff/boost state become server-authoritative, and consuming a pill goes through `POST /pills/consume`.

**Architecture:** Extend the cultivation-state DTO (backend) with the active buff + pending boost so the frontend reads them from the server. `useCultivationState` becomes the single source of buff/boost truth; `usePillInventory` shrinks to an API-backed inventory-list hook. The consume flow is wait-for-server: POST, refetch state, then fire the particle/toast.

**Tech Stack:** Backend — TypeScript, Express, Prisma, Vitest (integration vs real Postgres). Frontend — Next.js 16, React 19, TypeScript, Vitest (node env, pure-logic + `fetch`-stub tests), GSAP.

## Global Constraints

- **Branches:** the frontend UI lives on `feat/dan-duoc-ui`, the backend on `feat/dan-duoc-backend`. Task 1 merges both into `main`; all later tasks run on a `feat/dan-duoc-integration` branch off the merged `main`. Files edited in Tasks 3+ only exist after Task 1.
- Backend Clean Architecture: DTO shaping lives in the use case; `domain` stays framework-free. The DTO's `Date` fields serialize to ISO strings over JSON (existing `punishedUntil` convention).
- Frontend tests: pure-logic + `fetch`-stub only, `environment: node`, matched by `src/**/*.test.ts`. Animated components/hooks are human-observation.
- Frontend network goes through `apiFetch` (centralizes `credentials: "include"`, 401→refresh→retry, `{error:{code,message}}` unwrapping). Do not add new fetch/refresh logic.
- `CultivationState` (frontend) mirrors the backend `CultivationStateOutput` by hand — keep them in lockstep.
- Describe reused design/data as intentional reuse, not "copying".
- Commit messages OMIT any Co-Authored-By / Claude attribution trailer.
- Backend commands from `backend/`: `npm test`, `docker compose up -d --build`. Frontend from `frontend/`: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.
- Docker Postgres must be up for backend integration tests.

---

### Task 1: Land both feature branches on main

**Files:** git only (merge commits); expected textual overlaps in `CLAUDE.md` and `frontend/src/lib/types.ts` are additive (different regions) — but verify.

- [ ] **Step 1: Confirm both branches are green independently**

```bash
cd backend && npm test        # feat/dan-duoc-backend: expect 138 passing
```
(The frontend branch's gate was verified when it was built; re-run if unsure: `cd frontend && pnpm test`.)

- [ ] **Step 2: Merge the frontend branch into main**

```bash
git -C <repo> checkout main
git -C <repo> merge --no-ff feat/dan-duoc-ui -m "merge: đan dược frontend UI (mock)"
```
Expected: clean merge (frontend-only files + additive `types.ts`/`CLAUDE.md` sections).

- [ ] **Step 3: Merge the backend branch into main**

```bash
git -C <repo> merge --no-ff feat/dan-duoc-backend -m "merge: đan dược backend API"
```
If `CLAUDE.md` conflicts (both appended sections), keep BOTH sections (frontend Phase 3 note + backend Phase 4 note). If `frontend/src/lib/types.ts` conflicts, keep both the frontend branch's pill types and any backend-branch additions (backend branch shouldn't touch it — if it does, union the two). Resolve, then `git commit`.

- [ ] **Step 4: Verify the merged tree**

```bash
cd backend && npm test        # expect 138 passing
cd frontend && pnpm test && pnpm exec tsc --noEmit    # frontend gate green
```
Expected: both suites green on merged `main`.

- [ ] **Step 5: Create the integration branch**

```bash
git -C <repo> checkout -b feat/dan-duoc-integration
git -C <repo> branch --show-current   # feat/dan-duoc-integration
```

- [ ] **Step 6: Commit (merge commits already made; nothing extra)**

No new commit here — the two merges + the branch creation are the deliverable.

---

### Task 2: Extend the backend cultivation-state DTO

**Files:**
- Modify: `backend/src/application/GetCultivationStateUseCase.ts`
- Modify: `backend/src/application/ConsumePillUseCase.ts`
- Modify: `backend/tests/integration/cultivation.state.test.ts`

**Interfaces:**
- Produces: `CultivationStateOutput` (exported from `GetCultivationStateUseCase.ts`) gains `cultivationBuffMultiplier: number | null`, `cultivationBuffUntil: Date | null`, `breakthroughBonusPct: number`. `ConsumePillUseCase` returns the same three fields in its inline state object.

- [ ] **Step 1: Write the failing assertions**

In `backend/tests/integration/cultivation.state.test.ts`, add a test (mirror the file's existing register-then-GET pattern — read it first for the exact helper names):

```ts
it('exposes buff and boost fields (null/0 for a fresh character)', async () => {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ username: 'buff-fresh', password: 'password123' });
  const res = await agent.get('/cultivation/state');
  expect(res.status).toBe(200);
  expect(res.body.cultivationBuffMultiplier).toBeNull();
  expect(res.body.cultivationBuffUntil).toBeNull();
  expect(res.body.breakthroughBonusPct).toBe(0);
});

it('reflects a consumed cultivation buff and boost in the state', async () => {
  const agent = request.agent(app);
  await agent.post('/auth/register').send({ username: 'buff-active', password: 'password123' });
  await agent.post('/pills/consume').send({ pillId: 'tinh-tam-dan' });   // ×1.5, 120s
  await agent.post('/pills/consume').send({ pillId: 'pha-canh-dan' });   // +15%
  const res = await agent.get('/cultivation/state');
  expect(res.body.cultivationBuffMultiplier).toBe(1.5);
  expect(typeof res.body.cultivationBuffUntil).toBe('string'); // ISO
  expect(res.body.breakthroughBonusPct).toBe(15);
});
```

Ensure the file's `beforeEach` teardown already clears `inventoryItem`/`character`/`user` (it does). This file has **no** `beforeAll` pill seed and the second test consumes real pills, so add one at the top of the `describe` (or module level), matching `pills.routes.test.ts`:

```ts
beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});
```

Add `beforeAll` to the `vitest` import.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npm test -- cultivation.state`
Expected: FAIL — the three fields are `undefined`.

- [ ] **Step 3: Add the fields to the state use case**

In `backend/src/application/GetCultivationStateUseCase.ts`, add to the `CultivationStateOutput` interface (after `cultivationRate`):

```ts
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: Date | null;
  breakthroughBonusPct: number;
```

And to the returned object (after `cultivationRate: stage.cultivationRate,`):

```ts
      cultivationBuffMultiplier: character.cultivationBuffMultiplier,
      cultivationBuffUntil: character.cultivationBuffUntil,
      breakthroughBonusPct: character.breakthroughBonusPct,
```

- [ ] **Step 4: Add the same fields to ConsumePillUseCase's returned state**

In `backend/src/application/ConsumePillUseCase.ts`, in the final `return { ... }` block (after `cultivationRate: newStage.cultivationRate,`), add:

```ts
      cultivationBuffMultiplier: updated.cultivationBuffMultiplier,
      cultivationBuffUntil: updated.cultivationBuffUntil,
      breakthroughBonusPct: updated.breakthroughBonusPct,
```

(`updated` is the persisted `CharacterRecord`, which carries these fields.)

- [ ] **Step 5: Run to verify pass + full backend suite**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: typecheck clean; all tests pass (was 138, now 140 with the 2 new).

- [ ] **Step 6: Commit**

```bash
git add backend/src/application/GetCultivationStateUseCase.ts backend/src/application/ConsumePillUseCase.ts backend/tests/integration/cultivation.state.test.ts
git commit -m "feat(backend): expose cultivation buff and breakthrough bonus in state DTO"
```

---

### Task 3: Frontend types — mirror the extended DTO + flat inventory item

**Files:**
- Modify: `frontend/src/lib/types.ts`

**Interfaces:**
- Produces: `CultivationState` gains the three fields; new `PillInventoryItem` (flat). The mock `InventoryPill`/`ActiveBuff`/`PillEffect`/`PillDef` types are removed in Task 8 once their consumers are gone — this task only ADDS, to avoid breaking the still-mock hook mid-flight.

- [ ] **Step 1: Add the fields + new type**

In `frontend/src/lib/types.ts`, add to `CultivationState` (after `cultivationRate: number;`):

```ts
  cultivationBuffMultiplier: number | null;
  cultivationBuffUntil: string | null; // ISO 8601
  breakthroughBonusPct: number;
```

Add a new interface:

```ts
// Flat inventory item as returned by GET /pills/inventory (backend InventoryDto).
export interface PillInventoryItem {
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
  quantity: number;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: clean (additive only; existing mock types untouched).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(frontend): add DTO buff/boost fields and PillInventoryItem type"
```

---

### Task 4: Pill API client functions

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces: `fetchInventory(): Promise<PillInventoryItem[]>`, `consumePill(pillId: string): Promise<CultivationState>`.

- [ ] **Step 1: Write failing tests**

Append to `frontend/src/lib/api.test.ts` (reuse its `jsonResponse` helper + `vi.stubGlobal` pattern):

```ts
describe("pill api", () => {
  it("fetchInventory returns the parsed array", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, [{ id: "hoi-khi-dan", quantity: 5 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchInventory } = await import("./api");
    const inv = await fetchInventory();
    expect(inv).toEqual([{ id: "hoi-khi-dan", quantity: 5 }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/pills/inventory");
  });

  it("consumePill posts the pillId and returns fresh state", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { linhKhi: 42 }));
    vi.stubGlobal("fetch", fetchMock);
    const { consumePill } = await import("./api");
    const state = await consumePill("hoi-khi-dan");
    expect(state).toEqual({ linhKhi: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/pills/consume");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ pillId: "hoi-khi-dan" });
  });

  it("consumePill surfaces the server error message", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: { code: "PILL_OUT_OF_STOCK", message: "Hết hàng" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { consumePill } = await import("./api");
    await expect(consumePill("x")).rejects.toThrow("Hết hàng");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test -- api`
Expected: FAIL — `fetchInventory`/`consumePill` not exported.

- [ ] **Step 3: Implement the functions**

In `frontend/src/lib/api.ts`, add after the `apiFetch` definition (and import the types):

```ts
import type { ApiError, CultivationState, PillInventoryItem } from "./types";
```
(merge with the existing `import type { ApiError } ...` line)

```ts
export function fetchInventory(): Promise<PillInventoryItem[]> {
  return apiFetch<PillInventoryItem[]>("/pills/inventory");
}

export function consumePill(pillId: string): Promise<CultivationState> {
  return apiFetch<CultivationState>("/pills/consume", {
    method: "POST",
    body: JSON.stringify({ pillId }),
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd frontend && pnpm test -- api`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(frontend): add fetchInventory and consumePill api functions"
```

---

### Task 5: Derive buff/boost in useCultivationState

**Files:**
- Modify: `frontend/src/hooks/use-cultivation-state.ts`

**Interfaces:**
- Produces: the hook's return gains `cultivationBuffRemaining: number | null` and `breakthroughBonusPct: number`.

- [ ] **Step 1: Add the derived values**

In `frontend/src/hooks/use-cultivation-state.ts`:

Add to the `UseCultivationStateResult` interface:

```ts
  /** Seconds left on the active cultivation buff, or null when none/expired. */
  cultivationBuffRemaining: number | null;
  /** Pending breakthrough success bonus (percentage points); 0 when none. */
  breakthroughBonusPct: number;
```

After the existing `punishmentRemaining` derivation, add (same `now`-tick pattern):

```ts
  const cultivationBuffRemaining = (() => {
    if (!state?.cultivationBuffUntil) return null;
    const diff = (new Date(state.cultivationBuffUntil).getTime() - now) / 1000;
    return diff > 0 ? diff : null;
  })();

  const breakthroughBonusPct = state?.breakthroughBonusPct ?? 0;
```

Add both to the returned object.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/use-cultivation-state.ts
git commit -m "feat(frontend): derive cultivation buff countdown and boost from state"
```

---

### Task 6: Shrink usePillInventory to an API-backed list hook

**Files:**
- Rewrite: `frontend/src/hooks/use-pill-inventory.ts`

**Interfaces:**
- Produces:
  ```ts
  interface UsePillInventoryResult {
    inventory: PillInventoryItem[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    consume: (pillId: string) => Promise<CultivationState>;
  }
  function usePillInventory(enabled: boolean): UsePillInventoryResult
  ```
  `enabled` gates the initial fetch (modal-open lazy load).

- [ ] **Step 1: Rewrite the hook**

Replace the entire contents of `frontend/src/hooks/use-pill-inventory.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { consumePill, fetchInventory } from "@/lib/api";
import type { CultivationState, PillInventoryItem } from "@/lib/types";

export interface UsePillInventoryResult {
  inventory: PillInventoryItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  consume: (pillId: string) => Promise<CultivationState>;
}

// Server-backed inventory list. `enabled` gates the initial load so the fetch
// only fires once the modal opens (lazy), not on dashboard mount.
export function usePillInventory(enabled: boolean): UsePillInventoryResult {
  const [inventory, setInventory] = useState<PillInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const inv = await fetchInventory();
      setInventory(inv);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được kho đan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  const consume = useCallback(
    async (pillId: string): Promise<CultivationState> => {
      // Server is authoritative: POST first, then re-read the list so quantities
      // (and any 0-drop) reflect the committed state. The fresh cultivation
      // state is returned to the caller to reconcile the dashboard.
      const state = await consumePill(pillId);
      await refetch();
      return state;
    },
    [refetch],
  );

  return { inventory, loading, error, refetch, consume };
}
```

- [ ] **Step 2: Typecheck (expected to fail at consumers — that's Task 7/8)**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: errors ONLY in `page.tsx`/`pill-modal.tsx`/`pill-card.tsx` (old API usage) — fixed in Tasks 7–8. If any error is inside `use-pill-inventory.ts` itself, fix it here.

- [ ] **Step 3: Defer commit to Task 8**

This hook's consumers are updated in Tasks 7–8; commit them together at the end of Task 8 so each commit compiles. Proceed without committing.

---

### Task 7: Flatten pill-card and pill-modal to the API shape

**Files:**
- Modify: `frontend/src/components/pill-card.tsx`
- Modify: `frontend/src/components/pill-modal.tsx`

**Interfaces:**
- Consumes: `PillInventoryItem` (flat), `useCultivationState`'s disabled inputs unchanged.
- Produces: `PillCardProps.item: PillInventoryItem`; `PillModalProps.inventory: PillInventoryItem[]` plus `loading`/`error`/`onRetry` for the fetch-state UI.

- [ ] **Step 1: Flatten pill-card**

In `frontend/src/components/pill-card.tsx`, change the import and body from nested `item.def.X` to flat `item.X`:

```tsx
import type { CSSProperties } from "react";
import { getRarityMeta } from "@/lib/pill-constants";
import type { PillInventoryItem } from "@/lib/types";

interface PillCardProps {
  item: PillInventoryItem;
  disabled: boolean;
  disabledReason?: string;
  onUse: (pillId: string) => void;
}

export function PillCard({ item, disabled, disabledReason, onUse }: PillCardProps) {
  const rarity = getRarityMeta(item.rarity);

  return (
    <div className="pill-card" style={{ "--rarity": rarity.color } as CSSProperties}>
      <div className="pill-orb">
        <span className="pill-glyph">{item.glyph}</span>
      </div>
      <span className="pill-name">{item.name}</span>
      <span className="pill-rarity">{rarity.name}</span>
      <p className="pill-desc">{item.desc}</p>
      <span className="pill-qty">Số lượng: ×{item.quantity}</span>
      <button
        type="button"
        className="pill-use-btn"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onUse(item.id)}
      >
        {disabled ? (disabledReason ?? "Không thể dùng") : "Dùng"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update pill-modal to flat shape + fetch states**

In `frontend/src/components/pill-modal.tsx`, update the imports/props and the grid mapping. Change the props interface:

```tsx
import type { PillEffectKind, PillInventoryItem } from "@/lib/types";

interface PillModalProps {
  open: boolean;
  inventory: PillInventoryItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onUse: (pillId: string) => void;
  isDisabled: (kind: PillEffectKind) => { disabled: boolean; reason?: string };
}
```

Add `loading`, `error`, `onRetry` to the destructured params. Replace the panel body (the `{inventory.length === 0 ? ... }` block) with:

```tsx
        {error ? (
          <div className="pill-empty">
            <p style={{ color: "var(--red)", marginBottom: "1rem" }}>{error}</p>
            <button type="button" className="pill-use-btn" style={{ width: "auto" }} onClick={onRetry}>
              Thử Lại
            </button>
          </div>
        ) : loading && inventory.length === 0 ? (
          <p className="pill-empty">Đang tải kho đan...</p>
        ) : inventory.length === 0 ? (
          <p className="pill-empty">Đan phòng trống, cần luyện đan.</p>
        ) : (
          <div className="pill-grid">
            {inventory.map((item) => {
              const { disabled, reason } = isDisabled(item.effectKind);
              return (
                <PillCard
                  key={item.id}
                  item={item}
                  disabled={disabled}
                  disabledReason={reason}
                  onUse={onUse}
                />
              );
            })}
          </div>
        )}
```

(The GSAP open effect and backdrop/Escape handling are unchanged.)

- [ ] **Step 2b: Note on the stagger animation**

The card-stagger `useEffect` runs on `open`. Since cards now arrive asynchronously after fetch, the stagger may run before cards exist. Acceptable for this task (cards still fade in via CSS; human-observation gate). No code change required — do NOT add animation complexity here.

- [ ] **Step 3: Defer commit to Task 8**

Typecheck will still fail until `page.tsx` is updated (Task 8). Proceed.

---

### Task 8: Rewire page.tsx to the server-authoritative flow

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `usePillInventory(enabled)`, `useCultivationState`'s new `cultivationBuffRemaining`/`breakthroughBonusPct`, `getRarityMeta`.
- Produces: the fully wired dashboard. Final task — commits Tasks 6–8 together.

**Design for this task:** delete the mock-era client state (`linhKhiBonus`, `punishmentCleared` + its effect, `clearBreakthroughBoost`, `activeBuffs`, `pillNow`, `ConsumeCallbacks`). Buff strip + boost badge now read from `useCultivationState`. Consume is async wait-for-server.

- [ ] **Step 1: Update the hook destructuring**

Pull the new values from `useCultivationState`:

```tsx
  const {
    state,
    error,
    loading,
    refetch,
    displayLinhKhi,
    punishmentRemaining,
    cultivationBuffRemaining,
    breakthroughBonusPct,
  } = useCultivationState(
    isAuthenticated,
    useCallback(() => router.replace("/login"), [router]),
  );
```

Replace the `usePillInventory()` destructuring with the lazy, list-only hook:

```tsx
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const {
    inventory,
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
    consume,
  } = usePillInventory(pillModalOpen);
```

Delete these lines: `const [linhKhiBonus, setLinhKhiBonus] = useState(0);`, `const [punishmentCleared, setPunishmentCleared] = useState(false);`, and the old `usePillInventory()` block (with `activeBuffs`, `clearBreakthroughBoost`, `now: pillNow`).

- [ ] **Step 2: Delete the punishmentCleared reset effect**

Remove the `useEffect` that resets `punishmentCleared` when `punishmentRemaining === null`.

- [ ] **Step 3: Replace handleUsePill with the async flow**

Replace the mock `handleUsePill` (and its `ConsumeCallbacks`) with:

```tsx
  const handleUsePill = useCallback(
    async (pillId: string) => {
      const item = inventory.find((p) => p.id === pillId);
      try {
        await consume(pillId);        // POST /pills/consume + refetch inventory
        await refetch();              // pull authoritative cultivation state
        if (item) {
          const color = getRarityMeta(item.rarity).color;
          particleRef.current?.spawnBurst(color, item.effectKind === "linhKhi" ? 40 : 30);
          const msg =
            item.effectKind === "linhKhi"
              ? `Hấp thu ${item.amount} linh khí`
              : item.effectKind === "cultivationBuff"
                ? `Buff kích hoạt: ${item.name}`
                : item.effectKind === "breakthroughBoost"
                  ? `+${item.bonusPct}% đột phá`
                  : "Trạng thái trừng phạt đã được gỡ";
          addToast("Dùng Đan", msg, item.effectKind === "clearPunishment" ? "success" : "purple");
        }
      } catch (err) {
        addToast("Lỗi", err instanceof Error ? err.message : "Dùng đan thất bại", "danger");
      }
    },
    [inventory, consume, refetch, addToast],
  );
```

- [ ] **Step 4: Update the disabled predicate to use server state**

Replace `isPillDisabled`'s body to drop the `punishmentCleared`/optimism references — it now reads only `state` + `punishmentRemaining`:

```tsx
  const isPillDisabled = useCallback(
    (kind: PillEffectKind): { disabled: boolean; reason?: string } => {
      if (!state) return { disabled: true };
      if ((kind === "linhKhi" || kind === "breakthroughBoost") && state.isMaxStage) {
        return { disabled: true, reason: "Đã đạt cực cảnh" };
      }
      if (kind === "clearPunishment" && punishmentRemaining === null) {
        return { disabled: true, reason: "Không bị trừng phạt" };
      }
      return { disabled: false };
    },
    [state, punishmentRemaining],
  );
```

- [ ] **Step 5: Update derived render values + breakthrough completion**

Replace the `shownLinhKhi`/`shownPunishment`/`canBreakthrough` block with direct server values (optimism offsets are gone):

```tsx
  const canBreakthrough =
    !state.isMaxStage && displayLinhKhi >= state.linhKhiRequired;
```

Use `displayLinhKhi` directly in `<LingqiBar linhKhi={displayLinhKhi} ...>` and `punishmentRemaining` directly in `<StatsPanel punishmentRemaining={punishmentRemaining} />` and `<BreakthroughButton punishedRemaining={punishmentRemaining} ...>`.

In `handleTribulationComplete`, remove the `clearBreakthroughBoost();` call and its dep (the server resets the boost; the existing `refetch()` there pulls `breakthroughBonusPct: 0`).

- [ ] **Step 6: Update the buff strip + boost badge + modal props**

Buff strip now reads the cultivation-hook countdown (replace the `activeBuffs.map` block):

```tsx
            {(cultivationBuffRemaining !== null || breakthroughBonusPct > 0) && (
              <div className="buff-strip">
                {cultivationBuffRemaining !== null && state.cultivationBuffMultiplier && (
                  <span className="buff-chip">
                    Tăng tốc ×{state.cultivationBuffMultiplier} ({formatSeconds(cultivationBuffRemaining)})
                  </span>
                )}
                {breakthroughBonusPct > 0 && (
                  <span className="buff-chip">+{breakthroughBonusPct}% đột phá</span>
                )}
              </div>
            )}
```

Ensure `formatSeconds` is imported from `@/lib/format` — `page.tsx` does **not** import it yet, so add it: `import { formatSeconds } from "@/lib/format";`. Keep `<BreakthroughButton bonusPct={breakthroughBonusPct} ... />`.

Update the `<PillModal>` render with the new props:

```tsx
      <PillModal
        open={pillModalOpen}
        inventory={inventory}
        loading={inventoryLoading}
        error={inventoryError}
        onRetry={refetchInventory}
        onClose={() => setPillModalOpen(false)}
        onUse={handleUsePill}
        isDisabled={isPillDisabled}
      />
```

- [ ] **Step 7: Full frontend gate**

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm test`
Expected: lint clean, typecheck clean, tests pass. If lint flags formatting, run `pnpm format` and re-check.

- [ ] **Step 8: Commit Tasks 6–8 together**

```bash
git add frontend/src/hooks/use-pill-inventory.ts frontend/src/components/pill-card.tsx frontend/src/components/pill-modal.tsx frontend/src/app/page.tsx
git commit -m "feat(frontend): wire đan dược inventory and consume to the real API"
```

---

### Task 9: Remove mock logic, seed data, and dead types

**Files:**
- Delete: `frontend/src/lib/pill-logic.ts`, `frontend/src/lib/pill-logic.test.ts`
- Modify: `frontend/src/lib/pill-constants.ts` (drop catalog + seed), `frontend/src/lib/pill-constants.test.ts` (shrink to rarity)
- Modify: `frontend/src/lib/types.ts` (remove now-dead mock types)

**Interfaces:**
- Produces: `pill-constants.ts` exports only `RARITY_META` + `getRarityMeta`. Dead mock types removed.

- [ ] **Step 1: Delete the mock logic files**

```bash
git rm frontend/src/lib/pill-logic.ts frontend/src/lib/pill-logic.test.ts
```

- [ ] **Step 2: Trim pill-constants.ts to the rarity table**

Edit `frontend/src/lib/pill-constants.ts` to remove `PILL_DEFS` and `SEED_INVENTORY` (and their now-unused imports), keeping only `RARITY_META` and `getRarityMeta`. Verify nothing else imports the removed exports:

```bash
grep -rn "PILL_DEFS\|SEED_INVENTORY" frontend/src   # expect no matches after edit
```

- [ ] **Step 3: Shrink pill-constants.test.ts**

Rewrite `frontend/src/lib/pill-constants.test.ts` to assert only the rarity table (drop the pill-catalog assertions):

```ts
import { describe, expect, it } from "vitest";
import { getRarityMeta, RARITY_META } from "./pill-constants";

describe("pill-constants rarity table", () => {
  it("has an entry for tiers 0-4 with a name and color", () => {
    for (let r = 0; r <= 4; r++) {
      const meta = RARITY_META[r as 0];
      expect(typeof meta.name).toBe("string");
      expect(meta.color).toMatch(/^(#|var\()/);
    }
  });

  it("getRarityMeta returns the matching entry", () => {
    expect(getRarityMeta(4)).toBe(RARITY_META[4]);
  });
});
```

- [ ] **Step 4: Remove dead mock types from types.ts**

In `frontend/src/lib/types.ts`, remove `PillEffect`, `PillDef`, `InventoryPill`, and `ActiveBuff` (the mock-only types). Keep `PillRarity`, `PillEffectKind`, and `PillInventoryItem` (still used). Verify:

```bash
grep -rn "InventoryPill\|ActiveBuff\b\|PillDef\|PillEffect\b" frontend/src   # expect no matches
```

- [ ] **Step 5: Full gate**

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: all green; test count dropped (pill-logic tests gone, pill-constants shrunk), no dangling imports.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/lib
git commit -m "refactor(frontend): remove đan dược mock logic, seed, and dead types"
```

---

### Task 10: End-to-end verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Bring up the backend, seed pills**

```bash
cd backend && docker compose up -d --build
# wait for health, then ensure catalog seeded:
docker compose exec -T api npm run db:seed
```

- [ ] **Step 2: Run the frontend against the live backend**

```bash
cd frontend && pnpm dev   # http://localhost:3000
```

Logged in, confirm (human-observation):
- "Đan Phòng" opens → inventory loads from the server (8 starter pills, real quantities).
- Consume `Hồi Khí Đan` → after the round-trip, particle burst + toast fire, linh khí jumps, quantity drops; a page reload preserves the new quantity (server-authoritative).
- Consume `Tịnh Tâm Đan` → buff chip with countdown appears and **persists across a reload** (driven by state DTO, not client memory).
- Consume `Phá Cảnh Đan` → `+15%` badge on the breakthrough button + a boost chip; both survive reload; after a breakthrough resolves, the badge clears (server reset + refetch).
- Consume `Giải Phạt Đan` when not punished → disabled; after a failed breakthrough (punished), it consumes and clears punishment.
- Consume a single-quantity pill to 0 twice → the second attempt toasts the server's `PILL_OUT_OF_STOCK` message; the card is gone after refetch.
- At max stage, linh-khí + boost pills are disabled.

- [ ] **Step 3: Update CLAUDE.md**

Append a note under the Phase 4 / frontend section describing the integration: inventory + buff/boost now server-authoritative via `GET /pills/inventory` and the extended `/cultivation/state` DTO (`cultivationBuffMultiplier`/`cultivationBuffUntil`/`breakthroughBonusPct`); `usePillInventory` is an API-backed list hook (lazy on modal-open); `useCultivationState` owns the buff countdown + boost; consume is wait-for-server (POST → refetch → particle/toast); the mock (`pill-logic.ts`, `SEED_INVENTORY`, `PILL_DEFS`, client `ActiveBuff`) is removed. Reference the spec `docs/superpowers/specs/2026-07-18-dan-duoc-frontend-integration-design.md`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note đan dược frontend-backend integration in CLAUDE.md"
```
