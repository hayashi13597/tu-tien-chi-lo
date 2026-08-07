import { Prisma, PrismaClient } from '@prisma/client';
import { ProgressionRepository, LevelUpWithCostsResult, LearnWithCostsResult } from '../../domain/ports/ProgressionRepository';

// Signal rollback-guard cho cả hai flow: levelUpWithCosts và learnWithCosts.
// Mỗi catch biết flow mình đang chạy nên narrow lại union về đúng loại kết quả.
type ProgressionSignalResult =
  | Exclude<LevelUpWithCostsResult, { kind: 'updated' }>
  | Exclude<LearnWithCostsResult, { kind: 'learned' }>;

class ProgressionSignal extends Error {
  constructor(readonly result: ProgressionSignalResult) {
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
        const owned = await tx.ownedCongPhap.updateMany({
          where: { userId: input.userId, congPhapId: input.congPhapId, level: input.expectedLevel },
          data: { level: { increment: 1 } },
        });
        if (owned.count !== 1) throw new ProgressionSignal({ kind: 'concurrent' });

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
      // Flow này chỉ throw signal của levelUpWithCosts — narrow lại union.
      if (error instanceof ProgressionSignal) return error.result as LevelUpWithCostsResult;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'concurrent' };
      }
      throw error;
    }
  }

  async learnWithCosts(input: {
    userId: string;
    congPhapId: string;
    biTichMaterialId: string;
    linhThachCost: number;
  }): Promise<LearnWithCostsResult> {
    try {
      return await this.client.$transaction(async (tx) => {
        // 1) Tạo owned trước: đã sở hữu -> P2002 -> already-owned (không trừ gì).
        try {
          await tx.ownedCongPhap.create({ data: { userId: input.userId, congPhapId: input.congPhapId } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new ProgressionSignal({ kind: 'already-owned' });
          }
          throw e;
        }

        // 2) Trừ 1 Bí Tịch có guard tồn kho.
        const material = await tx.materialInventory.updateMany({
          where: { userId: input.userId, materialId: input.biTichMaterialId, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        });
        if (material.count !== 1) throw new ProgressionSignal({ kind: 'missing-bitich' });

        // 3) Trừ Linh Thạch có guard số dư.
        const character = await tx.character.updateMany({
          where: { userId: input.userId, linhThach: { gte: input.linhThachCost } },
          data: { linhThach: { decrement: input.linhThachCost } },
        });
        if (character.count !== 1) throw new ProgressionSignal({ kind: 'insufficient-linh-thach' });

        const [updatedCharacter, biTich] = await Promise.all([
          tx.character.findUniqueOrThrow({ where: { userId: input.userId } }),
          tx.materialInventory.findUnique({
            where: { userId_materialId: { userId: input.userId, materialId: input.biTichMaterialId } },
          }),
        ]);
        return { kind: 'learned' as const, linhThach: updatedCharacter.linhThach, biTichQuantity: biTich?.quantity ?? 0 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // Flow này chỉ throw signal của learnWithCosts — narrow lại union.
      if (error instanceof ProgressionSignal) return error.result as LearnWithCostsResult;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return { kind: 'concurrent' };
      }
      throw error;
    }
  }
}
