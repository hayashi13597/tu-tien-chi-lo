import { PillRecord, InventoryEntry } from '../pills/pill';

export interface PillRepository {
  findById(pillId: string): Promise<PillRecord | null>;
  // Full catalog INCLUDING inactive pills — admin-only. Player-facing reads use
  // listInventory (which filters inactive out).
  listAll(): Promise<PillRecord[]>;
  // Insert a brand-new definition. Callers must guarantee the id is free
  // (CreatePillUseCase checks findById first).
  create(pill: PillRecord): Promise<void>;
  // Full-row overwrite keyed by pill.id. Returns false if no row has that id.
  update(pill: PillRecord): Promise<boolean>;
  listInventory(userId: string): Promise<InventoryEntry[]>;
  // Atomically decrement one unit guarded on quantity > 0. Returns false if the
  // user doesn't own the pill or its quantity is already 0.
  decrementOne(userId: string, pillId: string): Promise<boolean>;
  // Compensating action for decrementOne: gives one unit back when the effect
  // could not be applied (e.g. the character write lost its concurrency guard),
  // so a failed consume never silently burns a pill.
  incrementOne(userId: string, pillId: string): Promise<void>;
  // Grant the starter kit: every active pill with starterQuantity > 0, at that
  // quantity. Driven by the DB catalog (not a hardcoded constant), so admins
  // control the new-user grant via the pill editor.
  seedStarterInventory(userId: string): Promise<void>;
}
