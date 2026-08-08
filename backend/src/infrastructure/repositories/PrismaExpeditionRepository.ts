import { Prisma, PrismaClient } from '@prisma/client';
import { DomainError } from '../../domain/errors';
import { gameDayFor } from '../../domain/expedition/expedition.calc';
import { ClaimExpeditionOutput, CurrentExpeditionOutput, ExpeditionRecord, ExpeditionStatus } from '../../domain/expedition/expedition';
import { ExpeditionRepository } from '../../domain/ports/ExpeditionRepository';

const DAILY_UNITS = 12;

function toRecord(row: {
  id: string; userId: string; branchId: string; durationSec: number; ticketCostUnits: number; startedAt: Date; completesAt: Date;
  status: string; seed: string; combatSnapshot: unknown; combatResult: unknown; rewardResult: unknown; claimedAt: Date | null;
  difficulty: { key: string };
}): ExpeditionRecord {
  return {
    id: row.id,
    userId: row.userId,
    branchId: row.branchId,
    difficulty: row.difficulty.key as ExpeditionRecord['difficulty'],
    durationSec: row.durationSec as ExpeditionRecord['durationSec'],
    ticketCostUnits: row.ticketCostUnits as ExpeditionRecord['ticketCostUnits'],
    startedAt: row.startedAt,
    completesAt: row.completesAt,
    status: row.status as ExpeditionStatus,
    seed: Number(row.seed),
    combatSnapshot: row.combatSnapshot as ExpeditionRecord['combatSnapshot'],
    combatResult: row.combatResult as ExpeditionRecord['combatResult'],
    rewardResult: row.rewardResult as ExpeditionRecord['rewardResult'],
    claimedAt: row.claimedAt,
  };
}

export class PrismaExpeditionRepository implements ExpeditionRepository {
  constructor(private readonly client: PrismaClient) {}

  async start(input: Parameters<ExpeditionRepository['start']>[0]): Promise<ExpeditionRecord> {
    try {
      return await this.client.$transaction(async (tx) => {
        const active = await tx.expedition.findFirst({ where: { userId: input.userId, status: { in: ['running', 'completed'] } } });
        if (active) throw new DomainError('EXPEDITION_ACTIVE', 'Bạn đang có một chuyến bí cảnh chưa claim');

        const quota = await tx.expeditionDailyQuota.upsert({
          where: { userId_gameDay: { userId: input.userId, gameDay: input.gameDay } },
          create: { userId: input.userId, gameDay: input.gameDay, spentUnits: 0 },
          update: {},
        });
        const reserved = await tx.expeditionDailyQuota.updateMany({
          where: { id: quota.id, spentUnits: { lte: DAILY_UNITS - input.ticketCostUnits } },
          data: { spentUnits: { increment: input.ticketCostUnits } },
        });
        if (reserved.count !== 1) throw new DomainError('INSUFFICIENT_EXPEDITION_TICKETS', 'Không đủ điểm vé bí cảnh');

        // Đan loadout (Phase 3): trừ guard nguyên tử, rollback cả vé lẫn expedition khi thiếu.
        for (const item of input.loadoutConsumptions ?? []) {
          const decremented = await tx.inventoryItem.updateMany({
            where: { userId: input.userId, pillId: item.pillId, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (decremented.count !== 1) throw new DomainError('INSUFFICIENT_INVENTORY', `Không đủ đan trong kho: ${item.pillId}`);
        }

        const difficulty = await tx.expeditionDifficulty.findUnique({ where: { branchId_key: { branchId: input.branchId, key: input.difficulty } } });
        if (!difficulty) throw new DomainError('EXPEDITION_DIFFICULTY_NOT_FOUND', 'Cấu hình độ khó không tồn tại');
        const row = await tx.expedition.create({
          data: {
            userId: input.userId,
            branchId: input.branchId,
            difficultyId: difficulty.id,
            durationSec: input.durationSec,
            ticketCostUnits: input.ticketCostUnits,
            startedAt: input.now,
            completesAt: new Date(input.now.getTime() + input.durationSec * 1000),
            status: 'running',
            seed: String(input.seed),
            combatSnapshot: input.combatSnapshot as object,
            combatResult: input.combatResult as object,
            rewardResult: input.rewardResult as object,
          },
          include: { difficulty: true },
        });
        return toRecord(row);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new DomainError('CONCURRENT_MODIFICATION', 'Chuyến bí cảnh vừa được thay đổi bởi request khác');
      }
      throw error;
    }
  }

  async getCurrent(userId: string, now: Date): Promise<CurrentExpeditionOutput> {
    return this.client.$transaction(async (tx) => {
      const gameDay = gameDayFor(now);
      const quota = await tx.expeditionDailyQuota.upsert({
        where: { userId_gameDay: { userId, gameDay } }, create: { userId, gameDay, spentUnits: 0 }, update: {},
      });
      const row = await tx.expedition.findFirst({
        where: { userId, status: { in: ['running', 'completed'] } },
        include: { difficulty: true }, orderBy: { startedAt: 'desc' },
      });
      let expedition = row ? toRecord(row) : null;
      if (row && row.status === 'running' && row.completesAt.getTime() <= now.getTime()) {
        const settled = await tx.expedition.update({ where: { id: row.id }, data: { status: 'completed' }, include: { difficulty: true } });
        expedition = toRecord(settled);
      }
      return { expedition, gameDay, spentUnits: quota.spentUnits, remainingUnits: Math.max(0, DAILY_UNITS - quota.spentUnits) };
    });
  }

  async claim(userId: string, now: Date): Promise<ClaimExpeditionOutput> {
    return this.client.$transaction(async (tx) => {
      let row = await tx.expedition.findFirst({ where: { userId, status: { in: ['running', 'completed'] } }, include: { difficulty: true }, orderBy: { startedAt: 'desc' } });
      if (!row) {
        const claimed = await tx.expedition.findFirst({ where: { userId, status: 'claimed' }, orderBy: { startedAt: 'desc' } });
        if (claimed) throw new DomainError('EXPEDITION_ALREADY_CLAIMED', 'Bí cảnh đã nhận thưởng');
        throw new DomainError('EXPEDITION_NOT_FOUND', 'Không có bí cảnh để nhận thưởng');
      }
      if (row.completesAt.getTime() > now.getTime()) throw new DomainError('EXPEDITION_NOT_COMPLETE', 'Bí cảnh chưa hoàn tất');
      if (row.status === 'running') {
        row = await tx.expedition.update({ where: { id: row.id }, data: { status: 'completed' }, include: { difficulty: true } });
      }
      const guarded = await tx.expedition.updateMany({ where: { id: row.id, status: 'completed', claimedAt: null }, data: { status: 'claimed', claimedAt: now } });
      if (guarded.count !== 1) throw new DomainError('EXPEDITION_ALREADY_CLAIMED', 'Bí cảnh đã nhận thưởng');

      const reward = row.rewardResult as unknown as ExpeditionRecord['rewardResult'];
      if (reward.linhThach > 0) await tx.character.updateMany({ where: { userId }, data: { linhThach: { increment: reward.linhThach } } });
      for (const material of reward.materials) {
        if (material.quantity <= 0) continue;
        await tx.materialInventory.upsert({
          where: { userId_materialId: { userId, materialId: material.materialId } },
          create: { userId, materialId: material.materialId, quantity: material.quantity },
          update: { quantity: { increment: material.quantity } },
        });
      }
      const claimed = await tx.expedition.findUniqueOrThrow({ where: { id: row.id }, include: { difficulty: true } });
      return { expedition: toRecord(claimed), reward };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
