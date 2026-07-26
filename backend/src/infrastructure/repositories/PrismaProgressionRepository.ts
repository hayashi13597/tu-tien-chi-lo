import { Prisma, PrismaClient } from '@prisma/client';
import { ProgressionRepository, LevelUpWithCostsResult } from '../../domain/ports/ProgressionRepository';

class ProgressionSignal extends Error {
  constructor(readonly result: Exclude<LevelUpWithCostsResult, { kind: 'updated' }>) {
    super(result.kind);
  }
}

export class PrismaProgressionRepository implements ProgressionRepository {
  constructor(private readonly client: PrismaClient) {}

  async levelUpWithCosts(input: {
    userId: string;
    congPhapId: string;
    expectedLevel: number;
    linhThachCost: number;
    materialId: string | null;
    materialCost: number;
  }): Promise<LevelUpWithCostsResult> {
    if (input.materialCost > 0 && !input.materialId) {
      throw new Error('CongPhap material cost requires materialId');
    }

    try {
      return await this.client.$transaction(async (tx) => {
        const character = await tx.character.updateMany({
          where: { userId: input.userId, linhThach: { gte: input.linhThachCost } },
          data: { linhThach: { decrement: input.linhThachCost } },
        });
        if (character.count !== 1) throw new ProgressionSignal({ kind: 'insufficient-linh-thach' });

        if (input.materialId && input.materialCost > 0) {
          const material = await tx.materialInventory.updateMany({
            where: { userId: input.userId, materialId: input.materialId, quantity: { gte: input.materialCost } },
            data: { quantity: { decrement: input.materialCost } },
          });
          if (material.count !== 1) throw new ProgressionSignal({ kind: 'insufficient-materials' });
        }

        const owned = await tx.ownedCongPhap.updateMany({
          where: { userId: input.userId, congPhapId: input.congPhapId, level: input.expectedLevel },
          data: { level: { increment: 1 } },
        });
        if (owned.count !== 1) throw new ProgressionSignal({ kind: 'concurrent' });

        const [updatedCharacter, materialInventory] = await Promise.all([
          tx.character.findUniqueOrThrow({ where: { userId: input.userId } }),
          input.materialId
            ? tx.materialInventory.findUnique({ where: { userId_materialId: { userId: input.userId, materialId: input.materialId } } })
            : Promise.resolve(null),
        ]);
        return {
          kind: 'updated' as const,
          level: input.expectedLevel + 1,
          linhThach: updatedCharacter.linhThach,
          materialQuantity: materialInventory?.quantity ?? 0,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ProgressionSignal) return error.result;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'concurrent' };
      }
      throw error;
    }
  }
}
