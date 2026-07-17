import { PrismaClient } from '@prisma/client';
import { PillRepository, STARTER_INVENTORY } from '../../domain/ports/PillRepository';
import { PillRecord, InventoryEntry, PillEffectKind } from '../../domain/pills/pill';

// Prisma stores effectKind as a plain string column; narrow it back to the
// domain union at the boundary (the seed only ever writes valid kinds).
function toPillRecord(row: {
  id: string; name: string; glyph: string; rarity: number; effectKind: string;
  amount: number | null; multiplier: number | null; durationSec: number | null;
  bonusPct: number | null; desc: string;
}): PillRecord {
  return { ...row, effectKind: row.effectKind as PillEffectKind };
}

export class PrismaPillRepository implements PillRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(pillId: string): Promise<PillRecord | null> {
    const row = await this.client.pill.findUnique({ where: { id: pillId } });
    return row ? toPillRecord(row) : null;
  }

  async listInventory(userId: string): Promise<InventoryEntry[]> {
    const items = await this.client.inventoryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { pill: true },
    });
    return items.map((it) => ({ pill: toPillRecord(it.pill), quantity: it.quantity }));
  }

  async decrementOne(userId: string, pillId: string): Promise<boolean> {
    // Row-level atomic guard: only decrements when the row exists AND quantity>0.
    // Two concurrent calls can't both drive one unit negative — the DB serializes
    // the conditional updates and count reflects how many actually matched.
    const result = await this.client.inventoryItem.updateMany({
      where: { userId, pillId, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } },
    });
    return result.count === 1;
  }

  async seedStarterInventory(userId: string): Promise<void> {
    await this.client.inventoryItem.createMany({
      data: STARTER_INVENTORY.map((s) => ({ userId, pillId: s.pillId, quantity: s.quantity })),
      skipDuplicates: true,
    });
  }
}
