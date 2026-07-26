import { PrismaClient } from '@prisma/client';
import { OwnedCongPhapRepository } from '../../domain/ports/OwnedCongPhapRepository';
import { OwnedCongPhapEntry, CongPhapCategory } from '../../domain/congphap/congphap';
import { PassiveEffect } from '../../domain/attributes/attributes.calc';

function toEntry(r: {
  level: number; equippedSlot: number | null;
  congPhap: {
    id: string; name: string; glyph: string; rarity: number; category: string; desc: string;
    active: boolean; maxLevel: number; baseCost: number; costGrowth: number;
    effects: unknown; powerPerLevel: number | null; chanNguyenCost: number | null;
    dupRefundLinhThach: number | null; upgradeMaterialId: string | null;
    baseMaterialCost: number; materialCostGrowth: number; cooldownRounds: number | null;
  };
}): OwnedCongPhapEntry {
  return {
    def: {
      ...r.congPhap,
      category: r.congPhap.category as CongPhapCategory,
      effects: (r.congPhap.effects as PassiveEffect[] | null) ?? null,
      upgradeMaterialId: r.congPhap.upgradeMaterialId,
      baseMaterialCost: r.congPhap.baseMaterialCost,
      materialCostGrowth: r.congPhap.materialCostGrowth,
      cooldownRounds: r.congPhap.cooldownRounds,
    },
    level: r.level,
    equippedSlot: r.equippedSlot,
  };
}

export class PrismaOwnedCongPhapRepository implements OwnedCongPhapRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByUser(userId: string): Promise<OwnedCongPhapEntry[]> {
    const rows = await this.client.ownedCongPhap.findMany({ where: { userId }, include: { congPhap: true } });
    return rows.map(toEntry);
  }
  async getOne(userId: string, congPhapId: string): Promise<OwnedCongPhapEntry | null> {
    const r = await this.client.ownedCongPhap.findUnique({ where: { userId_congPhapId: { userId, congPhapId } }, include: { congPhap: true } });
    return r ? toEntry(r) : null;
  }
  async grant(userId: string, congPhapId: string): Promise<boolean> {
    // createMany skipDuplicates: 0 rows tạo => đã sở hữu.
    const res = await this.client.ownedCongPhap.createMany({ data: [{ userId, congPhapId }], skipDuplicates: true });
    return res.count === 1;
  }
  async levelUpGuarded(userId: string, congPhapId: string, expectedLevel: number): Promise<boolean> {
    // Optimistic: chỉ +1 khi level vẫn = expectedLevel (chống double level-up song song).
    const res = await this.client.ownedCongPhap.updateMany({
      where: { userId, congPhapId, level: expectedLevel },
      data: { level: { increment: 1 } },
    });
    return res.count === 1;
  }
  async clearSlot(userId: string, slot: number): Promise<void> {
    await this.client.ownedCongPhap.updateMany({ where: { userId, equippedSlot: slot }, data: { equippedSlot: null } });
  }
  async setSlot(userId: string, congPhapId: string, slot: number): Promise<boolean> {
    const res = await this.client.ownedCongPhap.updateMany({ where: { userId, congPhapId }, data: { equippedSlot: slot } });
    return res.count === 1;
  }
  async unsetSlot(userId: string, congPhapId: string): Promise<boolean> {
    const res = await this.client.ownedCongPhap.updateMany({ where: { userId, congPhapId }, data: { equippedSlot: null } });
    return res.count === 1;
  }
}
