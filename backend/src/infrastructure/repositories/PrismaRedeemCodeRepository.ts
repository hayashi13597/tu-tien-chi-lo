import { PrismaClient, Prisma } from '@prisma/client';
import { RedeemCodeRepository, ReserveResult } from '../../domain/ports/RedeemCodeRepository';
import { RedeemCodeRecord, RewardEntry } from '../../domain/redeem/redeemCode';

function toRecord(row: { id: string; code: string; active: boolean; maxRedemptions: number; redeemedCount: number; expiresAt: Date | null; createdAt: Date; rewards: Array<{ pillId: string | null; congPhapId: string | null; linhThach: number | null; materialId: string | null; quantity: number }> }): RedeemCodeRecord {
  return {
    id: row.id, code: row.code, active: row.active, maxRedemptions: row.maxRedemptions,
    redeemedCount: row.redeemedCount, expiresAt: row.expiresAt,
    // Cột nullable -> field optional ở domain: chỉ mang theo loại reward thực sự được set.
    rewards: row.rewards.map((r) => ({
      ...(r.pillId !== null ? { pillId: r.pillId } : {}),
      ...(r.congPhapId !== null ? { congPhapId: r.congPhapId } : {}),
      ...(r.linhThach !== null ? { linhThach: r.linhThach } : {}),
      ...(r.materialId !== null ? { materialId: r.materialId } : {}),
      quantity: r.quantity,
    })),
  };
}

// Một RewardEntry -> hàng RedeemCodeReward (chỉ ghi loại được set).
function toRewardData(r: RewardEntry) {
  return {
    pillId: r.pillId ?? null,
    congPhapId: r.congPhapId ?? null,
    linhThach: r.linhThach ?? null,
    materialId: r.materialId ?? null,
    quantity: r.quantity,
  };
}

export class PrismaRedeemCodeRepository implements RedeemCodeRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByCode(code: string): Promise<RedeemCodeRecord | null> {
    const row = await this.client.redeemCode.findUnique({ where: { code }, include: { rewards: true } });
    return row ? toRecord(row) : null;
  }

  async listAll(): Promise<RedeemCodeRecord[]> {
    const rows = await this.client.redeemCode.findMany({ include: { rewards: true }, orderBy: { createdAt: 'desc' } });
    return rows.map(toRecord);
  }

  async create(record: RedeemCodeRecord): Promise<void> {
    const { rewards, ...scalars } = record;
    await this.client.redeemCode.create({
      data: { ...scalars, rewards: { create: rewards.map(toRewardData) } },
    });
  }

  async update(record: RedeemCodeRecord): Promise<boolean> {
    const { id, rewards, ...scalars } = record;
    const exists = await this.client.redeemCode.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return false;
    // Replace rewards wholesale inside a single transaction so the set is never
    // partially written (same pattern as PrismaRealmConfigRepository.replaceAll).
    await this.client.$transaction([
      this.client.redeemCodeReward.deleteMany({ where: { codeId: id } }),
      this.client.redeemCodeReward.createMany({ data: rewards.map((r) => ({ codeId: id, ...toRewardData(r) })) }),
      this.client.redeemCode.update({ where: { id }, data: scalars }),
    ]);
    return true;
  }

  async tryReserveRedemption(codeId: string, userId: string, maxRedemptions: number): Promise<ReserveResult> {
    // Step 1: Insert the Redemption row. The @@unique([codeId, userId]) constraint
    // fires immediately if this user already redeemed — no read-then-write race.
    try {
      await this.client.redemption.create({ data: { codeId, userId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return 'already_redeemed';
      }
      throw e;
    }
    // Step 2: Atomically increment the counter, guarded on the cap.
    const result = await this.client.redeemCode.updateMany({
      where: { id: codeId, redeemedCount: { lt: maxRedemptions } },
      data: { redeemedCount: { increment: 1 } },
    });
    if (result.count === 0) {
      // Cap already reached: compensate by removing the reservation we just inserted.
      await this.client.redemption.deleteMany({ where: { codeId, userId } });
      return 'exhausted';
    }
    return 'ok';
  }

  async grantRewards(userId: string, rewards: RewardEntry[]): Promise<void> {
    for (const r of rewards) {
      // Chỉ phần thưởng đan dược đi vào inventory; công pháp/Linh Thạch do
      // RedeemCodeUseCase cấp trực tiếp qua repo riêng của chúng.
      if (!r.pillId) continue;
      await this.client.inventoryItem.upsert({
        where: { userId_pillId: { userId, pillId: r.pillId } },
        create: { userId, pillId: r.pillId, quantity: r.quantity },
        update: { quantity: { increment: r.quantity } },
      });
    }
  }
}
