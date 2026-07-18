import { PillRecord, InventoryEntry } from '../pills/pill';

// New users start with this inventory (mirrors the frontend mock's seed subset).
export const STARTER_INVENTORY: Array<{ pillId: string; quantity: number }> = [
  { pillId: 'hoi-khi-dan', quantity: 5 },
  { pillId: 'tu-linh-dan', quantity: 3 },
  { pillId: 'cuu-chuyen-kim-dan', quantity: 1 },
  { pillId: 'tinh-tam-dan', quantity: 2 },
  { pillId: 'ngung-than-dan', quantity: 1 },
  { pillId: 'pha-canh-dan', quantity: 2 },
  { pillId: 'thien-cang-dan', quantity: 1 },
  { pillId: 'giai-phat-dan', quantity: 2 },
];

export interface PillRepository {
  findById(pillId: string): Promise<PillRecord | null>;
  listInventory(userId: string): Promise<InventoryEntry[]>;
  // Atomically decrement one unit guarded on quantity > 0. Returns false if the
  // user doesn't own the pill or its quantity is already 0.
  decrementOne(userId: string, pillId: string): Promise<boolean>;
  // Compensating action for decrementOne: gives one unit back when the effect
  // could not be applied (e.g. the character write lost its concurrency guard),
  // so a failed consume never silently burns a pill.
  incrementOne(userId: string, pillId: string): Promise<void>;
  seedStarterInventory(userId: string): Promise<void>;
}
