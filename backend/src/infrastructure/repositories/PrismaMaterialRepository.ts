import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { MaterialRepository } from '../../domain/ports/MaterialRepository';
import { MaterialInventoryRecord, MaterialRecord, MaterialSpendLine } from '../../domain/materials/material';

class InsufficientMaterialsError extends Error {}

function toMaterial(row: {
  id: string;
  name: string;
  glyph: string;
  rarity: number;
  description: string;
  active: boolean;
}): MaterialRecord {
  return row;
}

export class PrismaMaterialRepository implements MaterialRepository {
  constructor(private readonly client: PrismaClient) {}

  async listInventory(userId: string): Promise<MaterialInventoryRecord[]> {
    const rows = await this.client.materialInventory.findMany({
      where: { userId },
      include: { material: true },
      orderBy: { materialId: 'asc' },
    });
    return rows.map((row) => ({ materialId: row.materialId, quantity: row.quantity, material: toMaterial(row.material) }));
  }

  async getById(materialId: string): Promise<MaterialRecord | null> {
    const row = await this.client.material.findUnique({ where: { id: materialId } });
    return row ? toMaterial(row) : null;
  }

  async increment(userId: string, materialId: string, quantity: number): Promise<void> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError('INVALID_MATERIAL_CONFIG', 'material increment must be a positive integer');
    }
    await this.client.materialInventory.upsert({
      where: { userId_materialId: { userId, materialId } },
      create: { userId, materialId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  async spendMany(userId: string, lines: readonly MaterialSpendLine[]): Promise<boolean> {
    const required = new Map<string, number>();
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) return false;
      required.set(line.materialId, (required.get(line.materialId) ?? 0) + line.quantity);
    }

    try {
      await this.client.$transaction(async (tx) => {
        for (const [materialId, quantity] of required) {
          const result = await tx.materialInventory.updateMany({
            where: { userId, materialId, quantity: { gte: quantity } },
            data: { quantity: { decrement: quantity } },
          });
          if (result.count !== 1) throw new InsufficientMaterialsError();
        }
      });
      return true;
    } catch (error) {
      if (error instanceof InsufficientMaterialsError) return false;
      throw error;
    }
  }
}
