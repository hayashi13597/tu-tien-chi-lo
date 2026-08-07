import { describe, it, expect } from 'vitest';
import { EquipCongPhapUseCase } from './EquipCongPhapUseCase';
import { UnequipCongPhapUseCase } from './UnequipCongPhapUseCase';
import { LevelUpCongPhapUseCase } from './LevelUpCongPhapUseCase';
import { ListCongPhapUseCase } from './ListCongPhapUseCase';
import { CongPhapRecord, OwnedCongPhapEntry } from '../domain/congphap/congphap';
import { DomainError } from '../domain/errors';

const passive: CongPhapRecord = { id: 'p', name: 'P', glyph: 'p', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 3, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'khiHuyet', flatPerLevel: 10, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null };
const active: CongPhapRecord = { id: 'a', name: 'A', glyph: 'a', rarity: 2, category: 'active', desc: 'd', active: true, maxLevel: 3, baseCost: 100, costGrowth: 1.5, effects: null, powerPerLevel: 100, chanNguyenCost: 10, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 1, branch: 'chienDao', minRealmMajor: 0, biTichMaterialId: null };

function fakes(opts: { owned?: OwnedCongPhapEntry[]; linhThach?: number; materialQuantity?: number } = {}) {
  const defs = new Map([['p', passive], ['a', active]]);
  const owned = new Map<string, OwnedCongPhapEntry>();
  for (const o of opts.owned ?? []) owned.set(o.def.id, { ...o });
  let linhThach = opts.linhThach ?? 0;
  let materialQuantity = opts.materialQuantity ?? 0;

  const congphapRepo = {
    findById: async (id: string) => defs.get(id) ?? null,
    listActive: async () => [...defs.values()].filter((d) => d.active),
    listAll: async () => [...defs.values()],
    create: async () => {}, update: async () => true,
  };
  const ownedRepo = {
    listByUser: async () => [...owned.values()],
    getOne: async (_u: string, id: string) => owned.get(id) ?? null,
    grant: async (_u: string, id: string) => { if (owned.has(id)) return false; owned.set(id, { def: defs.get(id)!, level: 1, equippedSlot: null }); return true; },
    levelUpGuarded: async (_u: string, id: string, exp: number) => {
      const o = owned.get(id);
      if (!o || o.level !== exp) return false;
      // Replace (not mutate) so callers already holding an entry from getOne —
      // which the real Prisma repo always returns as an independent object —
      // don't see it change out from under them, matching production semantics.
      owned.set(id, { ...o, level: o.level + 1 });
      return true;
    },
    clearSlot: async (_u: string, slot: number) => { for (const o of owned.values()) if (o.equippedSlot === slot) o.equippedSlot = null; },
    setSlot: async (_u: string, id: string, slot: number) => { const o = owned.get(id); if (!o) return false; o.equippedSlot = slot; return true; },
    unsetSlot: async (_u: string, id: string) => { const o = owned.get(id); if (!o) return false; o.equippedSlot = null; return true; },
  };
  const charRepo = {
    findByUserId: async () => ({ id: 'c', userId: 'u', linhThach } as never),
    updateWithConcurrencyGuard: async () => ({} as never),
    spendLinhThach: async (_id: string, amt: number) => { if (linhThach < amt) return false; linhThach -= amt; return true; },
    addLinhThach: async (_id: string, amt: number) => { linhThach += amt; },
  };
  const progression = {
    levelUpWithCosts: async (input: { congPhapId: string; linhThachCost: number; materialCost: number }) => {
      const o = owned.get(input.congPhapId);
      if (!o || o.level !== 1) return { kind: 'concurrent' as const };
      if (linhThach < input.linhThachCost) return { kind: 'insufficient-linh-thach' as const };
      if (materialQuantity < input.materialCost) return { kind: 'insufficient-materials' as const };
      linhThach -= input.linhThachCost;
      materialQuantity -= input.materialCost;
      owned.set(input.congPhapId, { ...o, level: o.level + 1 });
      return { kind: 'updated' as const, level: 2, linhThach, materialQuantity };
    },
  };
  return { congphapRepo, ownedRepo, charRepo, progression, get linhThach() { return linhThach; }, get materialQuantity() { return materialQuantity; } };
}

describe('EquipCongPhapUseCase', () => {
  it('trang bị active vào slot hợp lệ', async () => {
    const f = fakes({ owned: [{ def: active, level: 1, equippedSlot: null }] });
    await new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 0);
    expect((await f.ownedRepo.getOne('u', 'a'))!.equippedSlot).toBe(0);
  });
  it('từ chối slot ngoài [0,4)', async () => {
    const f = fakes({ owned: [{ def: active, level: 1, equippedSlot: null }] });
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 4))
      .rejects.toMatchObject({ code: 'CONGPHAP_SLOT_INVALID' });
  });
  it('từ chối trang bị passive', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }] });
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'p', 0))
      .rejects.toMatchObject({ code: 'CONGPHAP_NOT_EQUIPPABLE' });
  });
  it('không sở hữu -> CONGPHAP_NOT_OWNED', async () => {
    const f = fakes();
    await expect(new EquipCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never).execute('u', 'a', 0))
      .rejects.toMatchObject({ code: 'CONGPHAP_NOT_OWNED' });
  });
});

describe('LevelUpCongPhapUseCase', () => {
  it('trừ Linh Thạch = levelUpCost và +1 level', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }], linhThach: 100 });
    const r = await new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never, f.progression as never).execute('u', 'p');
    expect(r.level).toBe(2);
    expect(r.linhThach).toBe(0);
  });
  it('thiếu Linh Thạch -> INSUFFICIENT_LINH_THACH', async () => {
    const f = fakes({ owned: [{ def: passive, level: 1, equippedSlot: null }], linhThach: 50 });
    await expect(new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never, f.progression as never).execute('u', 'p'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_THACH' });
  });
  it('đạt maxLevel -> CONGPHAP_MAX_LEVEL', async () => {
    const f = fakes({ owned: [{ def: passive, level: 3, equippedSlot: null }], linhThach: 9999 });
    await expect(new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never, f.progression as never).execute('u', 'p'))
      .rejects.toMatchObject({ code: 'CONGPHAP_MAX_LEVEL' });
  });

  it('nâng cấp trừ Linh Thạch và material trong cùng operation', async () => {
    const materialDef = { ...passive, upgradeMaterialId: 'm', baseMaterialCost: 2, materialCostGrowth: 1.5 };
    const f = fakes({ owned: [{ def: materialDef, level: 1, equippedSlot: null }], linhThach: 100, materialQuantity: 2 });
    const r = await new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never, f.progression as never).execute('u', 'p');
    expect(r).toMatchObject({ level: 2, linhThach: 0 });
    expect(r.material).toEqual({ id: 'm', quantity: 0 });
  });

  it('thiếu material không trừ Linh Thạch', async () => {
    const materialDef = { ...passive, upgradeMaterialId: 'm', baseMaterialCost: 2, materialCostGrowth: 1.5 };
    const f = fakes({ owned: [{ def: materialDef, level: 1, equippedSlot: null }], linhThach: 100, materialQuantity: 1 });
    await expect(new LevelUpCongPhapUseCase(f.ownedRepo as never, f.congphapRepo as never, f.charRepo as never, f.progression as never).execute('u', 'p'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_MATERIALS' });
    expect(f.linhThach).toBe(100);
  });
});
