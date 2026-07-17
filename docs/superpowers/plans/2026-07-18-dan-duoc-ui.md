# Đan Dược Inventory UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an alchemy inventory ("Đan Phòng") to the cultivation dashboard — a header-button GSAP modal where the player views mock-seeded pills (5 rarity tiers) and consumes them for four effects that play out visually on the existing dashboard.

**Architecture:** Approach A — a standalone client store (`use-pill-inventory` hook) owns all mock pill/buff state; consuming a pill runs pure logic (`pill-logic.ts`) then narrates the visual payoff through existing seams (`ParticleCanvas.spawnBurst`, `addToast`, and the page's client linh-khí optimism value). `useCultivationState` is untouched. No backend, no persistence — state resets on reload.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, GSAP 3.15 (plain `gsap` + `useEffect`, matching existing components), Tailwind 4, Vitest 3 (node environment), Biome 2.2.

## Global Constraints

- All new client components start with `"use client";` (React 19 / Next 16 App Router).
- Import paths use the `@/` alias (e.g. `@/lib/types`).
- All user-facing copy is Vietnamese.
- Tests: pure logic only, `environment: "node"`, files matched by `src/**/*.test.ts` (NOT `.tsx`). Animated components are human-observation, not snapshot-tested.
- GSAP usage follows existing components: `import gsap from "gsap"` + plain `useEffect`, NOT `@gsap/react`'s `useGSAP`.
- Particle API is fixed: `particleRef.current?.spawnBurst(color: string, count?: number)`. Do not add new particle systems.
- Describe reused design/data as intentional reuse, not "copying".
- Commit messages in this repo OMIT any Co-Authored-By / Claude attribution trailer.
- Biome a11y rules (react/next domains) are enabled — no click handlers on non-interactive elements; use `<button>` for the modal backdrop.
- Verification commands run from `frontend/`: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.

---

### Task 1: Pill & buff types

**Files:**
- Modify: `frontend/src/lib/types.ts` (append at end)

**Interfaces:**
- Consumes: nothing.
- Produces: `PillRarity`, `PillEffectKind`, `PillEffect`, `PillDef`, `InventoryPill`, `ActiveBuff` — imported by every later task.

- [ ] **Step 1: Append the type definitions**

Append to `frontend/src/lib/types.ts`:

```ts
export type PillRarity = 0 | 1 | 2 | 3 | 4;

export type PillEffectKind =
  | "linhKhi"
  | "cultivationBuff"
  | "breakthroughBoost"
  | "clearPunishment";

export interface PillEffect {
  kind: PillEffectKind;
  /** linhKhi: linh khí added immediately. */
  amount?: number;
  /** cultivationBuff: multiplier applied to cultivationRate while active. */
  multiplier?: number;
  /** cultivationBuff: buff lifetime in seconds. */
  durationSec?: number;
  /** breakthroughBoost: +percentage points to next breakthrough success. */
  bonusPct?: number;
}

export interface PillDef {
  id: string;
  name: string;
  glyph: string; // Hán tự shown on the pill orb
  rarity: PillRarity;
  effect: PillEffect;
  desc: string;
}

export interface InventoryPill {
  def: PillDef;
  quantity: number;
}

export interface ActiveBuff {
  kind: "cultivationBuff" | "breakthroughBoost";
  label: string;
  /** epoch ms; present for cultivationBuff only. */
  expiresAt?: number;
  multiplier?: number;
  bonusPct?: number;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors (new types are unused but valid).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(frontend): add đan dược pill and buff types"
```

---

### Task 2: Rarity table + mock pill content

**Files:**
- Create: `frontend/src/lib/pill-constants.ts`
- Test: `frontend/src/lib/pill-constants.test.ts`

**Interfaces:**
- Consumes: `PillDef`, `InventoryPill`, `PillRarity` from Task 1.
- Produces:
  - `RARITY_META: Record<PillRarity, { name: string; color: string }>`
  - `PILL_DEFS: PillDef[]`
  - `SEED_INVENTORY: InventoryPill[]`
  - `getRarityMeta(rarity: PillRarity): { name: string; color: string }`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/pill-constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PILL_DEFS, RARITY_META, SEED_INVENTORY } from "./pill-constants";

const EFFECT_KINDS = [
  "linhKhi",
  "cultivationBuff",
  "breakthroughBoost",
  "clearPunishment",
] as const;

describe("pill-constants", () => {
  it("has a rarity meta entry for tiers 0-4", () => {
    for (let r = 0; r <= 4; r++) {
      expect(RARITY_META[r as 0]).toBeDefined();
      expect(typeof RARITY_META[r as 0].name).toBe("string");
      expect(RARITY_META[r as 0].color).toMatch(/^(#|var\()/);
    }
  });

  it("gives every pill a valid rarity 0-4", () => {
    for (const p of PILL_DEFS) {
      expect(p.rarity).toBeGreaterThanOrEqual(0);
      expect(p.rarity).toBeLessThanOrEqual(4);
    }
  });

  it("gives every pill exactly one known effect kind", () => {
    for (const p of PILL_DEFS) {
      expect(EFFECT_KINDS).toContain(p.effect.kind);
    }
  });

  it("populates the required field for each effect kind", () => {
    for (const p of PILL_DEFS) {
      const e = p.effect;
      if (e.kind === "linhKhi") expect(e.amount).toBeGreaterThan(0);
      if (e.kind === "cultivationBuff") {
        expect(e.multiplier).toBeGreaterThan(1);
        expect(e.durationSec).toBeGreaterThan(0);
      }
      if (e.kind === "breakthroughBoost") expect(e.bonusPct).toBeGreaterThan(0);
      // clearPunishment needs no numeric field.
    }
  });

  it("covers all four effect kinds across the catalog", () => {
    const kinds = new Set(PILL_DEFS.map((p) => p.effect.kind));
    for (const k of EFFECT_KINDS) expect(kinds).toContain(k);
  });

  it("has unique pill ids", () => {
    const ids = PILL_DEFS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("seeds inventory only with catalog pills and positive quantities", () => {
    const catalogIds = new Set(PILL_DEFS.map((p) => p.id));
    for (const item of SEED_INVENTORY) {
      expect(catalogIds.has(item.def.id)).toBe(true);
      expect(item.quantity).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- pill-constants`
Expected: FAIL — cannot resolve `./pill-constants`.

- [ ] **Step 3: Create the constants module**

Create `frontend/src/lib/pill-constants.ts`:

```ts
import type { InventoryPill, PillDef, PillRarity } from "./types";

// Rarity presentation, mirroring how realm-constants.ts holds realm visuals.
// Colors reuse globals.css tokens where one exists; tier 2 has no token so a
// literal lam matches the realm palette's "Trúc Cơ" blue.
export const RARITY_META: Record<PillRarity, { name: string; color: string }> =
  {
    0: { name: "Phàm phẩm", color: "var(--muted)" },
    1: { name: "Hạ phẩm", color: "var(--jade)" },
    2: { name: "Trung phẩm", color: "#7dd3fc" },
    3: { name: "Thượng phẩm", color: "var(--purple)" },
    4: { name: "Tuyệt phẩm", color: "var(--gold)" },
  };

export function getRarityMeta(rarity: PillRarity) {
  return RARITY_META[rarity];
}

// Mock catalog: spans all 4 effect kinds and all 5 rarities.
export const PILL_DEFS: PillDef[] = [
  {
    id: "hoi-khi-dan",
    name: "Hồi Khí Đan",
    glyph: "气",
    rarity: 0,
    effect: { kind: "linhKhi", amount: 50 },
    desc: "Hấp thu linh khí tán loạn, cộng ngay 50 linh khí.",
  },
  {
    id: "tu-linh-dan",
    name: "Tụ Linh Đan",
    glyph: "聚",
    rarity: 2,
    effect: { kind: "linhKhi", amount: 300 },
    desc: "Ngưng tụ linh khí thiên địa, cộng ngay 300 linh khí.",
  },
  {
    id: "cuu-chuyen-kim-dan",
    name: "Cửu Chuyển Kim Đan",
    glyph: "金",
    rarity: 4,
    effect: { kind: "linhKhi", amount: 2000 },
    desc: "Thánh dược cửu chuyển, cộng ngay 2000 linh khí.",
  },
  {
    id: "tinh-tam-dan",
    name: "Tịnh Tâm Đan",
    glyph: "静",
    rarity: 1,
    effect: { kind: "cultivationBuff", multiplier: 1.5, durationSec: 120 },
    desc: "Tĩnh tâm ngưng thần, tăng 50% tốc độ tu luyện trong 2 phút.",
  },
  {
    id: "ngung-than-dan",
    name: "Ngưng Thần Đan",
    glyph: "凝",
    rarity: 3,
    effect: { kind: "cultivationBuff", multiplier: 2, durationSec: 180 },
    desc: "Thần thức thông suốt, tăng gấp đôi tốc độ tu luyện trong 3 phút.",
  },
  {
    id: "pha-canh-dan",
    name: "Phá Cảnh Đan",
    glyph: "破",
    rarity: 2,
    effect: { kind: "breakthroughBoost", bonusPct: 15 },
    desc: "Cộng 15% tỉ lệ thành công cho lần đột phá kế tiếp.",
  },
  {
    id: "thien-cang-dan",
    name: "Thiên Cang Đan",
    glyph: "罡",
    rarity: 4,
    effect: { kind: "breakthroughBoost", bonusPct: 40 },
    desc: "Cộng 40% tỉ lệ thành công cho lần đột phá kế tiếp.",
  },
  {
    id: "giai-phat-dan",
    name: "Giải Phạt Đan",
    glyph: "解",
    rarity: 3,
    effect: { kind: "clearPunishment" },
    desc: "Hóa giải phản phệ độ kiếp, lập tức gỡ trạng thái bị phạt.",
  },
];

// Seed inventory: a subset the player "already owns", with quantities.
export const SEED_INVENTORY: InventoryPill[] = [
  { def: PILL_DEFS[0], quantity: 5 },
  { def: PILL_DEFS[1], quantity: 3 },
  { def: PILL_DEFS[2], quantity: 1 },
  { def: PILL_DEFS[3], quantity: 2 },
  { def: PILL_DEFS[4], quantity: 1 },
  { def: PILL_DEFS[5], quantity: 2 },
  { def: PILL_DEFS[6], quantity: 1 },
  { def: PILL_DEFS[7], quantity: 2 },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- pill-constants`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pill-constants.ts frontend/src/lib/pill-constants.test.ts
git commit -m "feat(frontend): add đan dược rarity table and mock catalog"
```

---

### Task 3: Pure consume/expiry logic

**Files:**
- Create: `frontend/src/lib/pill-logic.ts`
- Test: `frontend/src/lib/pill-logic.test.ts`

**Interfaces:**
- Consumes: `InventoryPill`, `ActiveBuff` from Task 1.
- Produces:
  - `applyConsume(inventory: InventoryPill[], pillId: string): InventoryPill[]`
  - `expireBuffs(buffs: ActiveBuff[], now: number): ActiveBuff[]`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/pill-logic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ActiveBuff, InventoryPill, PillDef } from "./types";
import { applyConsume, expireBuffs } from "./pill-logic";

function def(id: string): PillDef {
  return {
    id,
    name: id,
    glyph: "丹",
    rarity: 0,
    effect: { kind: "linhKhi", amount: 1 },
    desc: "",
  };
}

describe("applyConsume", () => {
  it("decrements quantity by one", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 3 }];
    expect(applyConsume(inv, "a")[0].quantity).toBe(2);
  });

  it("removes the item when quantity hits zero", () => {
    const inv: InventoryPill[] = [
      { def: def("a"), quantity: 1 },
      { def: def("b"), quantity: 2 },
    ];
    const next = applyConsume(inv, "a");
    expect(next.map((i) => i.def.id)).toEqual(["b"]);
  });

  it("is a no-op for an unknown id", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 1 }];
    expect(applyConsume(inv, "zzz")).toEqual(inv);
  });

  it("does not mutate the input array", () => {
    const inv: InventoryPill[] = [{ def: def("a"), quantity: 2 }];
    applyConsume(inv, "a");
    expect(inv[0].quantity).toBe(2);
  });
});

describe("expireBuffs", () => {
  const active: ActiveBuff = {
    kind: "cultivationBuff",
    label: "x",
    expiresAt: 1000,
    multiplier: 2,
  };
  const boost: ActiveBuff = {
    kind: "breakthroughBoost",
    label: "y",
    bonusPct: 10,
  };

  it("drops buffs whose expiresAt is at or before now", () => {
    expect(expireBuffs([active], 1000)).toEqual([]);
    expect(expireBuffs([active], 1500)).toEqual([]);
  });

  it("keeps buffs whose expiresAt is after now", () => {
    expect(expireBuffs([active], 999)).toEqual([active]);
  });

  it("keeps buffs with no expiresAt (one-shot boosts)", () => {
    expect(expireBuffs([boost], 999999)).toEqual([boost]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test -- pill-logic`
Expected: FAIL — cannot resolve `./pill-logic`.

- [ ] **Step 3: Implement the pure functions**

Create `frontend/src/lib/pill-logic.ts`:

```ts
import type { ActiveBuff, InventoryPill } from "./types";

// Decrement one unit of the given pill; drop the stack when it reaches zero.
// Returns a new array (never mutates input) so React state updates stay pure.
export function applyConsume(
  inventory: InventoryPill[],
  pillId: string,
): InventoryPill[] {
  return inventory
    .map((item) =>
      item.def.id === pillId
        ? { ...item, quantity: item.quantity - 1 }
        : item,
    )
    .filter((item) => item.quantity > 0);
}

// Keep buffs that are one-shot (no expiresAt) or still in the future.
// A buff expiring exactly at `now` is treated as expired.
export function expireBuffs(buffs: ActiveBuff[], now: number): ActiveBuff[] {
  return buffs.filter((b) => b.expiresAt === undefined || b.expiresAt > now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test -- pill-logic`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pill-logic.ts frontend/src/lib/pill-logic.test.ts
git commit -m "feat(frontend): add pure pill consume and buff-expiry logic"
```

---

### Task 4: Pill inventory hook

**Files:**
- Create: `frontend/src/hooks/use-pill-inventory.ts`

**Interfaces:**
- Consumes: `SEED_INVENTORY` (Task 2); `applyConsume`, `expireBuffs` (Task 3); `ActiveBuff`, `InventoryPill`, `PillDef` (Task 1).
- Produces the hook return shape:
  ```ts
  interface ConsumeCallbacks {
    onLinhKhi: (amount: number, color: string) => void;
    onCultivationBuff: (label: string, color: string) => void;
    onBreakthroughBoost: (label: string, color: string) => void;
    onClearPunishment: (color: string) => void;
  }
  interface UsePillInventoryResult {
    inventory: InventoryPill[];
    activeBuffs: ActiveBuff[];
    breakthroughBonusPct: number; // 0 when no pending boost
    consume: (pillId: string, callbacks: ConsumeCallbacks) => void;
    clearBreakthroughBoost: () => void;
    now: number;
  }
  function usePillInventory(): UsePillInventoryResult
  ```

- [ ] **Step 1: Implement the hook**

Create `frontend/src/hooks/use-pill-inventory.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { getRarityMeta, SEED_INVENTORY } from "@/lib/pill-constants";
import { applyConsume, expireBuffs } from "@/lib/pill-logic";
import type { ActiveBuff, InventoryPill } from "@/lib/types";

export interface ConsumeCallbacks {
  onLinhKhi: (amount: number, color: string) => void;
  onCultivationBuff: (label: string, color: string) => void;
  onBreakthroughBoost: (label: string, color: string) => void;
  onClearPunishment: (color: string) => void;
}

export interface UsePillInventoryResult {
  inventory: InventoryPill[];
  activeBuffs: ActiveBuff[];
  breakthroughBonusPct: number;
  consume: (pillId: string, callbacks: ConsumeCallbacks) => void;
  clearBreakthroughBoost: () => void;
  now: number;
}

export function usePillInventory(): UsePillInventoryResult {
  const [inventory, setInventory] = useState<InventoryPill[]>(SEED_INVENTORY);
  const [activeBuffs, setActiveBuffs] = useState<ActiveBuff[]>([]);
  const [now, setNow] = useState(Date.now());

  // 1s tick drives buff countdown display and expiry (mirrors the cultivation
  // hook's own tick — buffs are client-only and independent of the server poll).
  useEffect(() => {
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setActiveBuffs((prev) => {
        const next = expireBuffs(prev, t);
        return next.length === prev.length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const clearBreakthroughBoost = useCallback(() => {
    setActiveBuffs((prev) =>
      prev.filter((b) => b.kind !== "breakthroughBoost"),
    );
  }, []);

  const consume = useCallback(
    (pillId: string, callbacks: ConsumeCallbacks) => {
      const item = inventory.find((i) => i.def.id === pillId);
      if (!item) return;
      const { def } = item;
      const color = getRarityMeta(def.rarity).color;
      const e = def.effect;

      setInventory((prev) => applyConsume(prev, pillId));

      switch (e.kind) {
        case "linhKhi":
          callbacks.onLinhKhi(e.amount ?? 0, color);
          break;
        case "cultivationBuff": {
          const label = `${def.name} ×${e.multiplier}`;
          setActiveBuffs((prev) => [
            // One cultivation buff at a time: drop any existing one, then add
            // the fresh one with a renewed expiry (refresh, never stack).
            ...prev.filter((b) => b.kind !== "cultivationBuff"),
            {
              kind: "cultivationBuff",
              label,
              multiplier: e.multiplier,
              expiresAt: Date.now() + (e.durationSec ?? 0) * 1000,
            },
          ]);
          callbacks.onCultivationBuff(label, color);
          break;
        }
        case "breakthroughBoost": {
          const label = `+${e.bonusPct}% đột phá`;
          setActiveBuffs((prev) => [
            ...prev.filter((b) => b.kind !== "breakthroughBoost"),
            { kind: "breakthroughBoost", label, bonusPct: e.bonusPct },
          ]);
          callbacks.onBreakthroughBoost(label, color);
          break;
        }
        case "clearPunishment":
          callbacks.onClearPunishment(color);
          break;
      }
    },
    [inventory],
  );

  const breakthroughBonusPct =
    activeBuffs.find((b) => b.kind === "breakthroughBoost")?.bonusPct ?? 0;

  return {
    inventory,
    activeBuffs,
    breakthroughBonusPct,
    consume,
    clearBreakthroughBoost,
    now,
  };
}
```

- [ ] **Step 2: Verify typecheck + lint pass**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors (hook is valid; unused-until-wired is fine).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/use-pill-inventory.ts
git commit -m "feat(frontend): add use-pill-inventory hook with client buff store"
```

---

### Task 5: Cauldron icon

**Files:**
- Modify: `frontend/src/components/icons.tsx` (append a new export)

**Interfaces:**
- Consumes: the existing `base(props)` helper and `IconProps` type in the file.
- Produces: `CauldronIcon(props: IconProps)` React component.

- [ ] **Step 1: Append the icon**

Append to `frontend/src/components/icons.tsx` (after `DiamondMarker`):

```tsx
// Alchemy cauldron (đan lô) used on the Đan Phòng header button.
export function CauldronIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <title>Đan Phòng</title>
      <path d="M8 3c0 1.5 1 2 1 3M12 3c0 1.5 1 2 1 3" />
      <path d="M4 8h16" />
      <path d="M6 8v5a6 6 0 0 0 12 0V8" />
      <path d="M9 21h6" />
      <path d="M12 19v2" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/icons.tsx
git commit -m "feat(frontend): add cauldron icon for đan phòng"
```

---

### Task 6: Đan Phòng styles

**Files:**
- Modify: `frontend/src/app/globals.css` (append a new section at end)

**Interfaces:**
- Produces CSS classes consumed by Tasks 7–9: `.pill-overlay`, `.pill-backdrop`, `.pill-panel`, `.pill-panel-title`, `.pill-grid`, `.pill-card`, `.pill-orb`, `.pill-glyph`, `.pill-name`, `.pill-rarity`, `.pill-desc`, `.pill-qty`, `.pill-use-btn`, `.pill-empty`, `.pill-close`, `.buff-strip`, `.buff-chip`, `.boost-badge`. Cards read a CSS variable `--rarity` set inline per card.

- [ ] **Step 1: Append the styles**

Append to `frontend/src/app/globals.css`:

```css
/* === ĐAN PHÒNG (alchemy inventory) === */
.pill-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
/* Accessible full-overlay backdrop button — click/Enter/Esc to close.
   A <button> (not a div) keeps this lint-clean under the a11y rules. */
.pill-backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(4, 2, 10, 0.7);
  backdrop-filter: blur(6px);
  cursor: pointer;
}
.pill-panel {
  position: relative;
  z-index: 1;
  width: min(920px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--surface-elevated);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
  padding: var(--space-6);
}
.pill-panel-title {
  font-family: var(--font-ma-shan), serif;
  font-size: 1.5rem;
  color: var(--gold);
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pill-close {
  background: none;
  border: 1px solid var(--border);
  color: var(--fg-dim);
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  font-size: 0.85rem;
}
.pill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}
.pill-card {
  border: 1px solid color-mix(in srgb, var(--rarity) 45%, transparent);
  border-radius: var(--radius);
  background: var(--surface);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  box-shadow: 0 0 18px color-mix(in srgb, var(--rarity) 18%, transparent);
  transition: transform var(--dur) var(--ease-out),
    box-shadow var(--dur) var(--ease-out);
}
.pill-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 0 28px color-mix(in srgb, var(--rarity) 40%, transparent);
}
.pill-orb {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 35% 30%,
    color-mix(in srgb, var(--rarity) 70%, #fff 10%),
    var(--rarity) 70%
  );
  box-shadow: 0 0 20px color-mix(in srgb, var(--rarity) 60%, transparent),
    inset -4px -4px 10px rgba(0, 0, 0, 0.4);
}
.pill-glyph {
  font-family: var(--font-ma-shan), serif;
  font-size: 1.6rem;
  color: #0a0512;
}
.pill-name {
  font-family: var(--font-zcool), serif;
  font-size: 1.05rem;
  color: var(--fg);
}
.pill-rarity {
  font-size: 0.75rem;
  color: var(--rarity);
  border: 1px solid color-mix(in srgb, var(--rarity) 50%, transparent);
  border-radius: 999px;
  padding: 1px var(--space-2);
}
.pill-desc {
  font-size: 0.8rem;
  color: var(--fg-dim);
  min-height: 2.5em;
}
.pill-qty {
  font-size: 0.8rem;
  color: var(--muted);
}
.pill-use-btn {
  margin-top: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--border-bright);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--gold) 15%, transparent);
  color: var(--gold);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background var(--dur-fast);
}
.pill-use-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--gold) 30%, transparent);
}
.pill-use-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pill-empty {
  text-align: center;
  color: var(--muted);
  padding: var(--space-8);
}
.buff-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.buff-chip {
  font-size: 0.75rem;
  color: var(--jade);
  border: 1px solid var(--jade-glow);
  border-radius: 999px;
  padding: 2px var(--space-2);
  background: rgba(93, 217, 177, 0.08);
}
.boost-badge {
  display: inline-block;
  margin-left: var(--space-2);
  font-size: 0.75rem;
  color: var(--gold);
}
```

- [ ] **Step 2: Verify build compiles the CSS**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: no errors (CSS is not typechecked, but this confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(frontend): add đan phòng modal and rarity card styles"
```

---

### Task 7: Pill card component

**Files:**
- Create: `frontend/src/components/pill-card.tsx`

**Interfaces:**
- Consumes: `InventoryPill` (Task 1), `getRarityMeta` (Task 2), CSS classes (Task 6).
- Produces:
  ```ts
  interface PillCardProps {
    item: InventoryPill;
    disabled: boolean;
    disabledReason?: string;
    onUse: (pillId: string) => void;
  }
  function PillCard(props: PillCardProps): JSX.Element
  ```

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/pill-card.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";
import { getRarityMeta } from "@/lib/pill-constants";
import type { InventoryPill } from "@/lib/types";

interface PillCardProps {
  item: InventoryPill;
  disabled: boolean;
  disabledReason?: string;
  onUse: (pillId: string) => void;
}

export function PillCard({
  item,
  disabled,
  disabledReason,
  onUse,
}: PillCardProps) {
  const { def, quantity } = item;
  const rarity = getRarityMeta(def.rarity);

  return (
    <div
      className="pill-card"
      style={{ "--rarity": rarity.color } as CSSProperties}
    >
      <div className="pill-orb">
        <span className="pill-glyph">{def.glyph}</span>
      </div>
      <span className="pill-name">{def.name}</span>
      <span className="pill-rarity">{rarity.name}</span>
      <p className="pill-desc">{def.desc}</p>
      <span className="pill-qty">Số lượng: ×{quantity}</span>
      <button
        type="button"
        className="pill-use-btn"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onUse(def.id)}
      >
        {disabled ? (disabledReason ?? "Không thể dùng") : "Dùng"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint pass**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pill-card.tsx
git commit -m "feat(frontend): add pill card component"
```

---

### Task 8: Pill modal component

**Files:**
- Create: `frontend/src/components/pill-modal.tsx`

**Interfaces:**
- Consumes: `PillCard` (Task 7), `InventoryPill`/`PillEffectKind` (Task 1), `CauldronIcon` (Task 5), CSS (Task 6), `gsap`.
- Produces:
  ```ts
  interface PillModalProps {
    open: boolean;
    inventory: InventoryPill[];
    onClose: () => void;
    onUse: (pillId: string) => void;
    isDisabled: (kind: PillEffectKind) => { disabled: boolean; reason?: string };
  }
  function PillModal(props: PillModalProps): JSX.Element | null
  ```

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/pill-modal.tsx`:

```tsx
"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { PillCard } from "@/components/pill-card";
import type { InventoryPill, PillEffectKind } from "@/lib/types";

interface PillModalProps {
  open: boolean;
  inventory: InventoryPill[];
  onClose: () => void;
  onUse: (pillId: string) => void;
  isDisabled: (kind: PillEffectKind) => { disabled: boolean; reason?: string };
}

export function PillModal({
  open,
  inventory,
  onClose,
  onUse,
  isDisabled,
}: PillModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Open animation: panel scales/fades in, cards stagger up. Runs each time the
  // modal transitions to open. GSAP + useEffect matches the existing overlays.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    gsap.fromTo(
      panel,
      { opacity: 0, scale: 0.92, y: 20 },
      { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power2.out" },
    );
    gsap.fromTo(
      panel.querySelectorAll(".pill-card"),
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.05,
        delay: 0.1,
        ease: "power2.out",
      },
    );
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pill-overlay">
      <button
        type="button"
        className="pill-backdrop"
        aria-label="Đóng đan phòng"
        onClick={onClose}
      />
      <div ref={panelRef} className="pill-panel">
        <div className="pill-panel-title">
          <span>Đan Phòng · 丹房</span>
          <button type="button" className="pill-close" onClick={onClose}>
            Đóng
          </button>
        </div>
        {inventory.length === 0 ? (
          <p className="pill-empty">Đan phòng trống, cần luyện đan.</p>
        ) : (
          <div className="pill-grid">
            {inventory.map((item) => {
              const { disabled, reason } = isDisabled(item.def.effect.kind);
              return (
                <PillCard
                  key={item.def.id}
                  item={item}
                  disabled={disabled}
                  disabledReason={reason}
                  onUse={onUse}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint pass**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pill-modal.tsx
git commit -m "feat(frontend): add đan phòng modal with GSAP open + card stagger"
```

---

### Task 9: Header button component

**Files:**
- Create: `frontend/src/components/pill-inventory-button.tsx`

**Interfaces:**
- Consumes: `CauldronIcon` (Task 5).
- Produces:
  ```ts
  interface PillInventoryButtonProps { onClick: () => void; }
  function PillInventoryButton(props: PillInventoryButtonProps): JSX.Element
  ```

- [ ] **Step 1: Implement the component**

Create `frontend/src/components/pill-inventory-button.tsx`:

```tsx
"use client";

import { CauldronIcon } from "@/components/icons";

interface PillInventoryButtonProps {
  onClick: () => void;
}

export function PillInventoryButton({ onClick }: PillInventoryButtonProps) {
  return (
    <button type="button" className="header-action" onClick={onClick}>
      <CauldronIcon />
      <span>Đan Phòng</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint pass**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/pill-inventory-button.tsx
git commit -m "feat(frontend): add đan phòng header button"
```

---

### Task 10: Breakthrough boost badge prop

**Files:**
- Modify: `frontend/src/components/breakthrough-button.tsx`

**Interfaces:**
- Consumes: existing `BreakthroughButtonProps`.
- Produces: `BreakthroughButtonProps` gains an optional `bonusPct?: number`; a `.boost-badge` renders inside the button label area when `bonusPct > 0`.

- [ ] **Step 1: Add the prop and badge**

In `frontend/src/components/breakthrough-button.tsx`, add `bonusPct` to the props interface (after `onError`):

```ts
  onError: (message: string) => void;
  /** Pending breakthrough-boost bonus from a consumed pill; 0 when none. */
  bonusPct?: number;
```

Add `bonusPct = 0` to the destructured params (after `onError`):

```ts
  onError,
  bonusPct = 0,
}: BreakthroughButtonProps) {
```

Then change the returned button to show the badge (replace the `<button>...</button>` block):

```tsx
      <button
        type="button"
        className="btn btn-danger"
        onClick={handleClick}
        disabled={disabled}
      >
        <span>{label}</span>
        {bonusPct > 0 && !isMaxStage && (
          <span className="boost-badge">+{bonusPct}%</span>
        )}
      </button>
```

- [ ] **Step 2: Verify typecheck + lint pass**

Run: `cd frontend && pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors (new prop is optional; existing call site still valid).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/breakthrough-button.tsx
git commit -m "feat(frontend): show breakthrough boost badge on button"
```

---

### Task 11: Wire everything into the dashboard

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `usePillInventory` + `ConsumeCallbacks` (Task 4), `PillModal` (Task 8), `PillInventoryButton` (Task 9), `BreakthroughButton.bonusPct` (Task 10), existing `particleRef`, `addToast`, `displayLinhKhi`, `punishmentRemaining`, `state`.
- Produces: the fully wired dashboard. No later task depends on it.

**Design notes for this task:**
- `linhKhi` effect: bump a new client-optimism offset added to `displayLinhKhi`, so the bar/stat jumps immediately; the next 10s server poll reconciles it (accepted mock behavior).
- `clearPunishment`: bump a local `punishmentCleared` flag that hides the punishment display until the next poll.
- The modal's `isDisabled` maps effect kinds to the edge-case rules (max stage; not punished).

- [ ] **Step 1: Add imports**

In `frontend/src/app/page.tsx`, add after the existing component imports:

```tsx
import { PillInventoryButton } from "@/components/pill-inventory-button";
import { PillModal } from "@/components/pill-modal";
import { usePillInventory } from "@/hooks/use-pill-inventory";
import type { ConsumeCallbacks } from "@/hooks/use-pill-inventory";
import type { PillEffectKind } from "@/lib/types";
```

- [ ] **Step 2: Add state + hook + client-optimism offsets**

Inside `Home()`, after the existing `const [phase, setPhase] = useState<BreakthroughPhase>("idle");` line, add:

```tsx
  const [pillModalOpen, setPillModalOpen] = useState(false);
  const [linhKhiBonus, setLinhKhiBonus] = useState(0);
  const [punishmentCleared, setPunishmentCleared] = useState(false);
  const {
    inventory,
    activeBuffs,
    breakthroughBonusPct,
    consume,
    clearBreakthroughBoost,
    now: pillNow,
  } = usePillInventory();
```

- [ ] **Step 3: Reset punishmentCleared when the server reports no punishment**

After the existing ambient-absorption `useEffect`, add:

```tsx
  // Once the server poll shows punishment is gone, drop the local clear flag so
  // a future punishment isn't masked by a stale flag.
  useEffect(() => {
    if (punishmentRemaining === null) setPunishmentCleared(false);
  }, [punishmentRemaining]);
```

- [ ] **Step 4: Add the consume handler + disabled mapping**

After `handleBreakthroughClick`, add:

```tsx
  const effectiveState = state;

  const handleUsePill = useCallback(
    (pillId: string) => {
      const callbacks: ConsumeCallbacks = {
        onLinhKhi: (amount, color) => {
          setLinhKhiBonus((b) => b + amount);
          particleRef.current?.spawnBurst(color, 40);
          addToast("Dùng Đan", `Hấp thu ${amount} linh khí`, "success");
        },
        onCultivationBuff: (label, color) => {
          particleRef.current?.spawnBurst(color, 30);
          addToast("Dược Lực", `Buff kích hoạt: ${label}`, "purple");
        },
        onBreakthroughBoost: (label, color) => {
          particleRef.current?.spawnBurst(color, 30);
          addToast("Dược Lực", label, "purple");
        },
        onClearPunishment: (color) => {
          setPunishmentCleared(true);
          particleRef.current?.spawnBurst(color, 30);
          addToast("Giải Phạt", "Trạng thái trừng phạt đã được gỡ", "success");
        },
      };
      consume(pillId, callbacks);
    },
    [consume, addToast],
  );

  const isPillDisabled = useCallback(
    (kind: PillEffectKind): { disabled: boolean; reason?: string } => {
      if (!effectiveState) return { disabled: true };
      if (
        (kind === "linhKhi" || kind === "breakthroughBoost") &&
        effectiveState.isMaxStage
      ) {
        return { disabled: true, reason: "Đã đạt cực cảnh" };
      }
      if (
        kind === "clearPunishment" &&
        (punishmentRemaining === null || punishmentCleared)
      ) {
        return { disabled: true, reason: "Không bị trừng phạt" };
      }
      return { disabled: false };
    },
    [effectiveState, punishmentRemaining, punishmentCleared],
  );
```

- [ ] **Step 5: Clear the breakthrough boost when a breakthrough resolves**

In `handleTribulationComplete`, add `clearBreakthroughBoost();` immediately before the final `refetch();` call, and add `clearBreakthroughBoost` to that callback's dependency array:

```tsx
    clearBreakthroughBoost();
    refetch();
  }, [addToast, refetch, clearBreakthroughBoost]);
```

- [ ] **Step 6: Compute displayed values and render the button + modal + buff strip**

Change the `canBreakthrough` block to include the linh-khí bonus and punishment-clear:

```tsx
  const shownLinhKhi = displayLinhKhi + linhKhiBonus;
  const shownPunishment = punishmentCleared ? null : punishmentRemaining;
  const canBreakthrough =
    !state.isMaxStage && shownLinhKhi >= state.linhKhiRequired;
```

In the header's `.cultivator-info` div, add the button before the logout button:

```tsx
          <PillInventoryButton onClick={() => setPillModalOpen(true)} />
```

Replace the `LingqiBar` usage's `linhKhi={displayLinhKhi}` with `linhKhi={shownLinhKhi}`, and the `BreakthroughButton`'s `punishedRemaining={punishmentRemaining}` with `punishedRemaining={shownPunishment}`, and add `bonusPct={breakthroughBonusPct}` to `BreakthroughButton`.

Under the `<StatsPanel ... />` inside `.hud-col-left`, add the buff strip:

```tsx
            {activeBuffs.length > 0 && (
              <div className="buff-strip">
                {activeBuffs.map((b) => (
                  <span key={b.kind} className="buff-chip">
                    {b.kind === "cultivationBuff" && b.expiresAt
                      ? `${b.label} (${Math.max(0, Math.ceil((b.expiresAt - pillNow) / 1000))}s)`
                      : b.label}
                  </span>
                ))}
              </div>
            )}
```

Finally, render the modal next to `<BreakthroughOverlay ...>`:

```tsx
      <PillModal
        open={pillModalOpen}
        inventory={inventory}
        onClose={() => setPillModalOpen(false)}
        onUse={handleUsePill}
        isDisabled={isPillDisabled}
      />
```

- [ ] **Step 7: Verify the full gate**

Run: `cd frontend && pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build`
Expected: lint clean, tsc clean, all tests pass (existing 19 + 14 new = 33), build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): wire đan phòng inventory and pill effects into dashboard"
```

---

### Task 12: Human verification + docs

**Files:**
- Modify: `CLAUDE.md` (append a Phase 3 note)

- [ ] **Step 1: Manual verification with backend up**

Run backend: `cd backend && docker compose up -d --build`
Run frontend: `cd frontend && pnpm dev`
In the browser at `http://localhost:3000` (logged in), confirm:
- "Đan Phòng" button in header opens the modal with a scale/fade + card stagger.
- Backdrop click and Escape both close it.
- `Hồi Khí Đan` (linhKhi): linh khí bar/stat jumps up, particle burst fires, toast shows; quantity drops by 1.
- `Tịnh Tâm Đan` (cultivationBuff): a buff chip with a live countdown appears near the stats panel; particle + toast fire.
- `Phá Cảnh Đan` (breakthroughBoost): `+15%` badge appears on the breakthrough button; a boost chip appears; after a breakthrough resolves the badge/chip clear.
- `Giải Phạt Đan` (clearPunishment): disabled with "Không bị trừng phạt" tooltip when not punished; after a failed breakthrough (punished), it becomes usable and clears the punishment display.
- At max stage, linhKhi + breakthroughBoost pills are disabled.
- A pill at quantity 1 disappears from the grid after use.

- [ ] **Step 2: Update CLAUDE.md**

Append under the Phase 3 section in `CLAUDE.md`:

```markdown
Đan Dược (alchemy inventory): frontend-only mock feature. A header "Đan Phòng" button opens a GSAP modal (`pill-modal.tsx`) showing a seeded pill inventory (`lib/pill-constants.ts`, 5 rarity tiers) rendered as `pill-card.tsx`. `use-pill-inventory.ts` owns mock inventory + client-only active buffs (its own 1s tick, independent of the cultivation server poll); pure `lib/pill-logic.ts` (`applyConsume`/`expireBuffs`) is unit-tested. Consuming a pill narrates effects onto the dashboard via existing seams — `ParticleCanvas.spawnBurst`, `addToast`, and page-local optimism offsets (`linhKhiBonus`, `punishmentCleared`) — without touching `useCultivationState`. Four effects: tăng linh khí (optimistic, reconciled by the next 10s poll), buff tốc độ tu (timed chip + countdown), tăng tỉ lệ đột phá (one-shot badge on the breakthrough button, cleared when a breakthrough resolves), giải trừng phạt. No persistence — state resets on reload (accepted mock limitation). Spec: `docs/superpowers/specs/2026-07-18-dan-duoc-ui-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note đan dược inventory feature in CLAUDE.md"
```
