# Đan Dược UI/UX — Design Spec

Date: 2026-07-18
Scope: Frontend-only (Next.js), mock data. No backend, no persistence.

## Goal

Add an alchemy inventory ("Đan Phòng") to the cultivation dashboard: the player
views pills they already own (kho đan) and consumes them (dùng đan) for effects
that play out visually on the existing dashboard. This is a mock-data feature —
pills are seeded client-side and effects are simulated locally. A future backend
can replace the mock store without touching the presentational layer.

Reference game: Nhất Niệm Tiêu Dao / 一念逍遥 (alchemy system). Only the
inventory + consume surface is in scope; furnace/luyện đan and recipe book are not.

## Decisions (from brainstorming)

- **Scope:** frontend UI/UX only, mock data (no backend API in this task).
- **Feature surface:** Kho đan (inventory) + Dùng đan (consume). No furnace, no recipe book.
- **Location:** header button → floating GSAP modal over the dashboard (same
  pattern as the former stats modal).
- **Effects (all 4):** tăng linh khí tức thì, buff tốc độ tu (có thời hạn),
  tăng tỉ lệ đột phá lần kế tiếp, giải trừng phạt.
- **Rarity:** 5-tier quality system with distinct color + glow.
- **Animation:** rich — GSAP for modal + card stagger, reusing the existing
  `ParticleCanvas` for consume bursts.
- **Architecture (Approach A):** a standalone client store owns mock pill/buff
  state; effects are "narrated" onto the dashboard through existing seams
  (`particleRef`, `addToast`, the client linh-khí optimism value). The working
  `useCultivationState` hook is untouched.

## Data Model

Added to `src/lib/types.ts` (pure types, no framework):

```ts
type PillRarity = 0 | 1 | 2 | 3 | 4;
type PillEffectKind = "linhKhi" | "cultivationBuff" | "breakthroughBoost" | "clearPunishment";

interface PillEffect {
  kind: PillEffectKind;
  amount?: number;        // linhKhi: linh khí added
  multiplier?: number;    // cultivationBuff: cultivationRate multiplier
  durationSec?: number;   // cultivationBuff: buff lifetime
  bonusPct?: number;      // breakthroughBoost: +% success for next breakthrough
}

interface PillDef {
  id: string;
  name: string;      // Vietnamese pill name
  glyph: string;     // Hán tự shown on the pill orb
  rarity: PillRarity;
  effect: PillEffect;
  desc: string;      // Vietnamese effect description
}

interface InventoryPill { def: PillDef; quantity: number; }

interface ActiveBuff {
  kind: "cultivationBuff" | "breakthroughBoost";
  label: string;
  expiresAt?: number;   // epoch ms; cultivationBuff only
  multiplier?: number;  // cultivationBuff
  bonusPct?: number;    // breakthroughBoost (one-shot, no expiry)
}
```

### Rarity table

| Bậc | Tên | Màu | Token |
|---|---|---|---|
| 0 | Phàm phẩm | xám | `--muted` |
| 1 | Hạ phẩm | jade | `--jade` |
| 2 | Trung phẩm | lam | `#7dd3fc` |
| 3 | Thượng phẩm | tím | `--purple` |
| 4 | Tuyệt phẩm | vàng | `--gold` |

### Mock content (`src/lib/pill-constants.ts`)

~8 pill definitions spanning all 4 effect kinds and all 5 rarities, plus a seed
inventory (subset with quantities). Vietnamese names, e.g. Hồi Khí Đan, Tụ Linh
Đan, Phá Cảnh Đan, Giải Phạt Đan, Cửu Chuyển Kim Đan. Presentation-only data,
mirroring how `realm-constants.ts` holds realm presentation.

## State & Logic Layer

### `src/hooks/use-pill-inventory.ts`
Self-contained hook (style of `use-toast.ts`). Owns:
- `inventory: InventoryPill[]` — seeded from `pill-constants.ts`
- `activeBuffs: ActiveBuff[]` — active cultivation buff + pending breakthrough boost

Actions:
- `consume(pillId, callbacks)` — runs `applyConsume` to decrement/remove, pushes
  an `ActiveBuff` for timed/one-shot effects, and delegates the visible payoff to
  callbacks passed by the page (keeps the hook free of DOM/particle/toast knowledge).
- Internal `setInterval` (1s tick, like `punishmentRemaining`) expires cultivation
  buffs and drives the countdown.

### `src/lib/pill-logic.ts` (pure, unit-tested)
- `applyConsume(inventory, pillId) → InventoryPill[]` — decrement, remove at 0,
  no-op on unknown id.
- `expireBuffs(buffs, now) → ActiveBuff[]` — drop expired, keep active, boundary
  handling at `now`.

### Effect resolution (page wires callbacks)
- `linhKhi` → nudge the client linh-khí optimism value + `particleRef.spawnBurst(rarityColor)` + toast.
- `cultivationBuff` → hook stores `ActiveBuff{expiresAt}`; countdown badge; toast + particle.
- `breakthroughBoost` → hook stores a one-shot pending boost; cleared when the
  next breakthrough resolves (either outcome); toast + badge on breakthrough button.
- `clearPunishment` → callback clears the punishment display + toast.

`useCultivationState` is untouched. Buffs are cosmetic overlays driven by the
hook's own interval, independent of the 10s server poll.

## Components

All under `src/components/`, className-driven with `globals.css` tokens.

1. **`pill-inventory-button.tsx`** — header action ("Đan Phòng", 丹/cauldron icon)
   beside the logout button; opens the modal.
2. **`pill-modal.tsx`** — floating modal. A11y pattern from the former stats modal:
   an accessible sibling `<button>` backdrop fills the overlay (click + Esc to
   close) while `.popup-panel` (position: relative) stacks above — lint-clean under
   Biome a11y rules. Contains title ("Đan Phòng · 丹房"), an optional filter-by-
   effect-kind chip row (included since seed has >6 pills), a stagger-animated grid
   of `pill-card`, and an empty state ("Đan phòng trống, cần luyện đan").
3. **`pill-card.tsx`** — one pill: glyph in a rarity-colored orb, name, rarity
   badge, effect description, `×N` quantity, and a "Dùng" button. Rarity drives
   border/glow via `data-rarity` → CSS. Disabled when the effect can't apply.

### Dashboard integration (`src/app/page.tsx`)
- Render `<PillInventoryButton>` in header, `<PillModal>` at root (sibling to
  `BreakthroughOverlay`).
- Consume callbacks wire into existing `particleRef`, `addToast`, and the client
  linh-khí optimism value.
- Buff strip near `StatsPanel` shows the active cultivation buff (countdown) and
  pending breakthrough boost; boost indicator also on `BreakthroughButton`.
- `handleTribulationComplete` clears the pending breakthrough boost after a
  breakthrough resolves.

### GSAP motion (rich)
- Modal open: overlay fade + panel scale/translate via `useGSAP`.
- Cards: stagger fade-up on open.
- Card hover: glow pulse (CSS).
- Consume: pill orb shrinks/flies toward center, then `particleRef.spawnBurst(rarityColor, count)` — reuses the existing canvas, no new particle system.

### CSS
New `=== ĐAN PHÒNG ===` section appended to `globals.css`, using existing tokens
plus the 5 rarity colors. New 丹/cauldron icon in `icons.tsx`.

## Data Flow (consume happy path)
1. User clicks "Dùng" on a `pill-card`.
2. `page.tsx` handler calls `consume(pillId, callbacks)`.
3. Hook runs `applyConsume`; for timed/one-shot effects pushes an `ActiveBuff`.
4. Hook invokes the matching callback → particle burst (rarity color) + toast +
   client display update.
5. Grid re-renders (quantity drops; card fades out at 0).

## Edge Cases
- **Max stage** — `linhKhi` and `breakthroughBoost` pills disabled ("Đã đạt cực cảnh").
- **Not punished** — `clearPunishment` pill disabled ("Không bị trừng phạt").
- **Buff already active** — another `cultivationBuff` refreshes/extends the timer
  (no stacking). One active cultivation buff at a time.
- **Pending boost + breakthrough resolves** — boost cleared on either outcome
  (it was used), via existing `handleTribulationComplete`.
- **10s server poll** — buffs are client-only and the poll does NOT clear them
  (driven by the hook's own interval). The `linhKhi` bump is optimistic and WILL
  be reconciled by the next poll — accepted, consistent with existing `displayLinhKhi`
  optimism. Known mock limitation.
- **Empty inventory** — empty state.
- **Reload** — all pill/buff state resets (no persistence). Accepted mock limitation.

## Testing
Pure-logic unit tests only (Phase 3 rule: `environment: node`, `src/**/*.test.ts`;
animated components are human-observation, not snapshots).
- `src/lib/pill-logic.test.ts` — `applyConsume` (decrement, remove-at-zero,
  unknown-id no-op); `expireBuffs` (expired removed, active kept, `now` boundary).
- `src/lib/pill-constants.test.ts` — every pill has valid rarity 0–4, exactly one
  effect kind, required fields present per kind.
- No hook/component tests (React/DOM/GSAP), consistent with the existing suite.

### Verification gate
`pnpm lint` + `tsc` + `pnpm test` + `pnpm build` green, then human observation:
modal open/close, card stagger, each of the 4 consume effects (particles/toast/
badges), and disabled states.

## File Inventory

New:
- `src/lib/pill-constants.ts`
- `src/lib/pill-logic.ts`
- `src/lib/pill-logic.test.ts`
- `src/lib/pill-constants.test.ts`
- `src/hooks/use-pill-inventory.ts`
- `src/components/pill-inventory-button.tsx`
- `src/components/pill-modal.tsx`
- `src/components/pill-card.tsx`

Modified:
- `src/lib/types.ts` — pill/buff types
- `src/app/page.tsx` — button + modal, consume callbacks, buff strip, boost badge, clear-boost
- `src/components/breakthrough-button.tsx` — optional boost indicator prop
- `src/app/globals.css` — Đan Phòng styles + rarity colors
- `src/components/icons.tsx` — 丹/cauldron icon
- `CLAUDE.md` — Phase 3 note update

## Out of Scope (YAGNI)
Luyện đan/furnace, recipe book, backend API/domain/Prisma, pill persistence,
buff stacking, multi-effect pills.
