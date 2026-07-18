# Đan Dược Frontend Integration — Design Spec

Date: 2026-07-18
Scope: Wire the đan dược frontend UI to the real backend API, replacing the
client-side mock. Includes a small backend DTO extension. Server becomes the
source of truth for inventory and buffs.

## Goal

The đan dược inventory UI (`feat/dan-duoc-ui`) currently runs on a client-side
mock (`use-pill-inventory` with seeded data + client buffs). The backend
(`feat/dan-duoc-backend`) now persists pills, inventory, and buff/boost state.
This task connects them: the frontend reads its inventory and buff/boost state
from the server and consumes pills through the real API, so pill effects are
authoritative and survive reloads.

## Decisions (from brainstorming)

1. **Branches:** merge both feature branches into `main` first, then integrate
   on a fresh `feat/dan-duoc-integration` branch.
2. **Buff/boost data:** extend the cultivation-state DTO with the active buff +
   pending boost fields (server-authoritative), rather than keeping them client-side.
3. **Inventory source:** fully from `GET /pills/inventory`; drop `SEED_INVENTORY`.
   `pill-constants.ts` keeps only the rarity color/name table (presentation).
4. **Consume flow:** wait-for-server — POST, then fire particle/toast and
   reconcile state from the response. No optimistic UI, no rollback.
5. **Testing:** pure-logic + API-stub on the frontend (Phase 3 discipline); one
   small backend integration addition for the 3 new DTO fields.

## Backend Contract Change

`CultivationStateOutput` (returned by `GET /cultivation/state`,
`POST /cultivation/breakthrough`, and `POST /pills/consume`) gains three fields,
mapped from the `Character` each use case already loads (no new queries):

```ts
interface CultivationStateOutput {
  // ...existing...
  cultivationBuffMultiplier: number | null;  // active timed buff, null when none
  cultivationBuffUntil: string | null;       // ISO 8601; null when none
  breakthroughBonusPct: number;              // pending boost, 0 when none
}
```

Touches `GetCultivationStateUseCase` and `ConsumePillUseCase` — the two use
cases that build this state DTO. `AttemptBreakthroughUseCase` returns a
different shape (`{ success, character }`), so it needs **no** change; the
frontend reads the reset boost via its post-breakthrough refetch of
`/cultivation/state`. The `cultivation.state` integration test gains 3
assertions for the new fields.

Note: `cultivationBuffUntil` is serialized as an ISO string over JSON (the
existing `punishedUntil` field already establishes this Date→string convention
in the DTO).

## Frontend

### `lib/types.ts`
- `CultivationState` gains the same three fields (it mirrors the backend DTO by hand).
- New `PillInventoryItem` mirroring the backend `InventoryDto` — a **flat** shape
  (not the mock's nested `{ def, quantity }`):

```ts
interface PillInventoryItem {
  id: string; name: string; glyph: string; rarity: PillRarity;
  effectKind: PillEffectKind;
  amount: number | null; multiplier: number | null;
  durationSec: number | null; bonusPct: number | null;
  desc: string; quantity: number;
}
```

- The mock's `InventoryPill`/`ActiveBuff` types are removed (no client buff state).

### `lib/api.ts`
Two functions, both through `apiFetch` (inherit `credentials: "include"`, the
single-shot 401→refresh→retry, and `{error:{code,message}}` unwrapping):

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

### `hooks/use-cultivation-state.ts` — single source of buff/boost truth
Derives from the three new DTO fields (no new state, no new timer; reuses the
existing 1s `now` tick):
- `cultivationBuffRemaining: number | null` — `cultivationBuffUntil − now` in
  seconds, or null when absent/expired (same pattern as `punishmentRemaining`).
- `breakthroughBonusPct: number` — straight from `state.breakthroughBonusPct`.

`displayLinhKhi` interpolation is unchanged: the server bakes the buff into the
polled `linhKhi`, so base-rate interpolation between 10s polls is a close-enough
approximation, reconciled each poll.

### `hooks/use-pill-inventory.ts` — shrinks to an inventory-list hook
```ts
interface UsePillInventoryResult {
  inventory: PillInventoryItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;                            // GET /pills/inventory
  consume: (pillId: string) => Promise<CultivationState>;  // POST, returns fresh state
}
```
- Fetches inventory when the modal opens (lazy).
- `consume` POSTs; on success returns the fresh `CultivationState` and refetches
  the inventory list.
- No `activeBuffs`, no `clearBreakthroughBoost`, no `now`, no mock — all removed.

### `app/page.tsx` — async wait-for-server consume
```
handleUsePill(pillId):
  try:
    const fresh = await consume(pillId)     // POST /pills/consume
    await refetchCultivationState()         // pull authoritative linhKhi/buff/punishment
    const item = inventory.find(id === pillId)
    particleRef.spawnBurst(getRarityMeta(item.rarity).color, count)  // fire AFTER confirm
    addToast(effect-kind-specific message)
  catch (err):
    addToast("Lỗi", err.message, "danger")  // server message (409/400)
```
- Buff strip reads `cultivationBuffRemaining` from the cultivation hook (chip +
  countdown via `formatSeconds`, same as punishment).
- `BreakthroughButton bonusPct={breakthroughBonusPct}` comes from the cultivation
  hook now.
- `handleTribulationComplete` no longer clears the boost (server resets it; the
  post-breakthrough refetch pulls `breakthroughBonusPct: 0`).
- **Removed:** `linhKhiBonus`, `punishmentCleared` + its reset effect,
  `clearBreakthroughBoost`, the mock `ConsumeCallbacks` plumbing.

### Components
- `pill-card.tsx` / `pill-modal.tsx`: switch `item.def.X` → flat `item.X`. Rarity
  color/name still via `getRarityMeta(item.rarity)`.
- `pill-modal.tsx`: refetch inventory on open; distinguish a fetch-failure state
  (error + retry button) from the empty state ("Đan phòng trống").
- `isDisabled(kind)` stays (client pre-check from cultivation state); the server
  is the real guard.

### `lib/pill-constants.ts`
Keeps `RARITY_META` / `getRarityMeta` (color + name). `SEED_INVENTORY` and the
pill catalog (`PILL_DEFS`) are removed — the server owns the catalog.

### Deleted
- `lib/pill-logic.ts` + `lib/pill-logic.test.ts` (`applyConsume`/`expireBuffs`
  only served the mock; the server owns consume + buff expiry now).

## Error Handling
- `consumePill` rejection → `apiFetch` already threw `Error(server message)`;
  `handleUsePill` catches and toasts it (`PILL_OUT_OF_STOCK` 409,
  `PILL_NOT_APPLICABLE` 400). Inventory/state untouched on error.
- 401 mid-consume → `apiFetch`'s silent refresh-retry; if refresh fails it throws
  `"Authentication expired"`, toasted by the catch (rare; no special-casing).
- Inventory fetch failure on modal open → error state + retry button, distinct
  from the empty state.

## Edge Cases
- **Disabled pills** — still computed client-side from cultivation state
  (`isMaxStage`/punishment) to pre-empt obviously-invalid consumes; server
  re-validates.
- **Stale inventory** (consumed elsewhere) → 409 toast, then refetch resyncs.
- **Quantity 0** → backend omits it (`quantity > 0` filter); post-consume refetch
  drops the card.
- **Buff refresh** — server refreshes an active buff; next poll/refetch shows the
  new countdown.
- **Empty inventory** → "Đan phòng trống" empty state.

## Testing
- `lib/api.test.ts`: `fetchInventory` parses the array; `consumePill` sends
  `{pillId}` and returns state; a server error message surfaces. `fetch` stubbed
  as in the existing refresh tests.
- Backend: `cultivation.state` integration test +3 assertions for the new DTO fields.
- `lib/pill-constants.test.ts` shrinks to rarity-table assertions.
- `lib/pill-logic.test.ts` deleted.
- Animated components/hooks remain human-observation.

## File Inventory

Backend (modified):
- `src/application/GetCultivationStateUseCase.ts` (DTO type + 3 fields)
- `src/application/ConsumePillUseCase.ts` (3 fields in its returned state)
- `tests/integration/cultivation.state.test.ts` (+3 assertions)

(`AttemptBreakthroughUseCase` is unchanged — it returns `{ success, character }`,
not the state DTO.)

Frontend (modified):
- `src/lib/types.ts`, `src/lib/api.ts`, `src/lib/api.test.ts`
- `src/hooks/use-cultivation-state.ts`, `src/hooks/use-pill-inventory.ts`
- `src/app/page.tsx`
- `src/components/pill-card.tsx`, `src/components/pill-modal.tsx`
- `src/lib/pill-constants.ts`, `src/lib/pill-constants.test.ts`
- `CLAUDE.md`

Frontend (deleted):
- `src/lib/pill-logic.ts`, `src/lib/pill-logic.test.ts`

## Out of Scope (YAGNI)
Pill crafting/luyện đan, obtaining pills beyond the seed, optimistic UI +
rollback, real-time buff push (10s poll suffices), offline consume queueing.
