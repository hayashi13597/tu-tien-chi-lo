import { Prisma, PrismaClient } from '@prisma/client';
import { CongPhapRepository } from '../../domain/ports/CongPhapRepository';
import { CongPhapRecord, CongPhapCategory, CongPhapBranch } from '../../domain/congphap/congphap';
import { PassiveEffect } from '../../domain/attributes/attributes.calc';

// Prisma lưu category/branch là string, effects là Json — narrow lại về domain ở biên.
function toRecord(row: {
  id: string; name: string; glyph: string; rarity: number; category: string; desc: string;
  active: boolean; maxLevel: number; baseCost: number; costGrowth: number;
  effects: unknown; powerPerLevel: number | null; chanNguyenCost: number | null;
  dupRefundLinhThach: number | null; upgradeMaterialId: string | null;
  baseMaterialCost: number; materialCostGrowth: number; cooldownRounds: number | null;
  tier: number; branch: string | null; minRealmMajor: number; biTichMaterialId: string | null;
}): CongPhapRecord {
  return {
    ...row,
    category: row.category as CongPhapCategory,
    branch: (row.branch as CongPhapBranch | null) ?? null,
    effects: (row.effects as PassiveEffect[] | null) ?? null,
    upgradeMaterialId: row.upgradeMaterialId,
    baseMaterialCost: row.baseMaterialCost,
    materialCostGrowth: row.materialCostGrowth,
    cooldownRounds: row.cooldownRounds,
  };
}

// Chuẩn bị data cho Prisma: effects null -> Prisma.DbNull (cột Json nullable ở
// DB, không phải JSON "null" literal). Dùng DbNull thay vì omit key vì
// updateMany bỏ qua key nghĩa là "không đổi" — cần set rõ để clear khi
// công pháp chuyển từ passive (có effects) sang active (effects=null).
function toData(def: CongPhapRecord) {
  const { effects, ...rest } = def;
  return { ...rest, effects: effects === null ? Prisma.DbNull : (effects as unknown as object) };
}

export class PrismaCongPhapRepository implements CongPhapRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<CongPhapRecord | null> {
    const row = await this.client.congPhap.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }
  async listActive(): Promise<CongPhapRecord[]> {
    const rows = await this.client.congPhap.findMany({ where: { active: true }, orderBy: [{ rarity: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }
  async listAll(): Promise<CongPhapRecord[]> {
    const rows = await this.client.congPhap.findMany({ orderBy: [{ rarity: 'asc' }, { id: 'asc' }] });
    return rows.map(toRecord);
  }
  async create(def: CongPhapRecord): Promise<void> {
    await this.client.congPhap.create({ data: toData(def) });
  }
  async update(def: CongPhapRecord): Promise<boolean> {
    const { id, ...data } = toData(def);
    const result = await this.client.congPhap.updateMany({ where: { id: def.id }, data });
    return result.count === 1;
  }
}
