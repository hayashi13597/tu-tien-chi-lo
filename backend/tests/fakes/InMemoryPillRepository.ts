import { PillRepository } from '../../src/domain/ports/PillRepository';
import { PillRecord, InventoryEntry } from '../../src/domain/pills/pill';

// Default catalog the fake seeds via seedStarterDefinitions — mirrors the
// production seed's ids + starter quantities so DB-driven starter logic is
// exercised without a real database.
const DEFAULT_STARTERS: Array<{ pillId: string; quantity: number }> = [
  { pillId: 'hoi-khi-dan', quantity: 5 },
  { pillId: 'tu-linh-dan', quantity: 3 },
  { pillId: 'cuu-chuyen-kim-dan', quantity: 1 },
  { pillId: 'tinh-tam-dan', quantity: 2 },
  { pillId: 'ngung-than-dan', quantity: 1 },
  { pillId: 'pha-canh-dan', quantity: 2 },
  { pillId: 'thien-cang-dan', quantity: 1 },
  { pillId: 'giai-phat-dan', quantity: 2 },
];

export class InMemoryPillRepository implements PillRepository {
  private pills = new Map<string, PillRecord>();
  // key: `${userId}:${pillId}` -> quantity
  private inv = new Map<string, number>();

  /** Test helper: register a pill definition. */
  seedPill(pill: PillRecord): void {
    this.pills.set(pill.id, pill);
  }

  /** Test helper: register minimal definitions for every starter pill (active,
   *  with a starterQuantity) so seedStarterInventory grants them — mirrors
   *  production where the DB catalog drives the starter kit. */
  seedStarterDefinitions(): void {
    for (const { pillId, quantity } of DEFAULT_STARTERS) {
      this.seedPill({ id: pillId, name: pillId, glyph: 'x', rarity: 0, effectKind: 'linhKhi', amount: 0, multiplier: null, durationSec: null, bonusPct: null, desc: '', active: true, starterQuantity: quantity });
    }
  }

  /** Test helper: set a user's quantity for a pill directly. */
  setQuantity(userId: string, pillId: string, quantity: number): void {
    this.inv.set(`${userId}:${pillId}`, quantity);
  }

  async findById(pillId: string): Promise<PillRecord | null> {
    return this.pills.get(pillId) ?? null;
  }

  async listAll(): Promise<PillRecord[]> {
    return [...this.pills.values()];
  }

  async create(pill: PillRecord): Promise<void> {
    this.pills.set(pill.id, pill);
  }

  async update(pill: PillRecord): Promise<boolean> {
    if (!this.pills.has(pill.id)) return false;
    this.pills.set(pill.id, pill);
    return true;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const out: InventoryEntry[] = [];
    for (const [key, quantity] of this.inv.entries()) {
      const [uid, pillId] = key.split(':');
      if (uid !== userId || quantity <= 0) continue;
      const pill = this.pills.get(pillId);
      // Hide inactive pills, matching the Prisma relation filter.
      if (pill && pill.active) out.push({ pill, quantity });
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
    // DB-driven: grant every active pill with starterQuantity > 0.
    for (const pill of this.pills.values()) {
      if (pill.active && pill.starterQuantity > 0) {
        this.inv.set(`${userId}:${pill.id}`, pill.starterQuantity);
      }
    }
  }
}
