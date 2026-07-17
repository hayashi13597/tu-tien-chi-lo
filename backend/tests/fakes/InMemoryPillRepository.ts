import { PillRepository, STARTER_INVENTORY } from '../../src/domain/ports/PillRepository';
import { PillRecord, InventoryEntry } from '../../src/domain/pills/pill';

export class InMemoryPillRepository implements PillRepository {
  private pills = new Map<string, PillRecord>();
  // key: `${userId}:${pillId}` -> quantity
  private inv = new Map<string, number>();

  /** Test helper: register a pill definition. */
  seedPill(pill: PillRecord): void {
    this.pills.set(pill.id, pill);
  }

  /** Test helper: set a user's quantity for a pill directly. */
  setQuantity(userId: string, pillId: string, quantity: number): void {
    this.inv.set(`${userId}:${pillId}`, quantity);
  }

  async findById(pillId: string): Promise<PillRecord | null> {
    return this.pills.get(pillId) ?? null;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const out: InventoryEntry[] = [];
    for (const [key, quantity] of this.inv.entries()) {
      const [uid, pillId] = key.split(':');
      if (uid !== userId || quantity <= 0) continue;
      const pill = this.pills.get(pillId);
      if (pill) out.push({ pill, quantity });
    }
    return out;
  }

  async decrementOne(userId: string, pillId: string): Promise<boolean> {
    const key = `${userId}:${pillId}`;
    const q = this.inv.get(key) ?? 0;
    if (q <= 0) return false;
    this.inv.set(key, q - 1);
    return true;
  }

  async seedStarterInventory(userId: string): Promise<void> {
    for (const { pillId, quantity } of STARTER_INVENTORY) {
      this.inv.set(`${userId}:${pillId}`, quantity);
    }
  }
}
