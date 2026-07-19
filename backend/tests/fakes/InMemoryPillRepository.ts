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

  /** Test helper: register minimal definitions for every starter pill, so that
   *  listInventory (which joins on a known definition) returns them after
   *  seedStarterInventory — mirrors production where the FK guarantees defs. */
  seedStarterDefinitions(): void {
    for (const { pillId } of STARTER_INVENTORY) {
      this.seedPill({ id: pillId, name: pillId, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 0, multiplier: null, durationSec: null, bonusPct: null, desc: '', active: true, starterQuantity: 0 });
    }
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

  async incrementOne(userId: string, pillId: string): Promise<void> {
    const key = `${userId}:${pillId}`;
    this.inv.set(key, (this.inv.get(key) ?? 0) + 1);
  }

  async seedStarterInventory(userId: string): Promise<void> {
    for (const { pillId, quantity } of STARTER_INVENTORY) {
      this.inv.set(`${userId}:${pillId}`, quantity);
    }
  }
}
