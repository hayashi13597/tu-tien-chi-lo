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
