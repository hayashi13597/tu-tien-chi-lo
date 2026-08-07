import { describe, expect, it } from 'vitest';
import { GetAlchemyProfileUseCase } from './GetAlchemyProfileUseCase';
import { RankUpAlchemyUseCase } from './RankUpAlchemyUseCase';
import { UpgradeFurnaceUseCase } from './UpgradeFurnaceUseCase';
import { ListAlchemyRecipesUseCase } from './ListAlchemyRecipesUseCase';
import { QueueAlchemyUseCase } from './QueueAlchemyUseCase';
import { AlchemyProfileRecord } from '../domain/alchemy/alchemy.profile';

const profile = (overrides: Partial<AlchemyProfileRecord> = {}): AlchemyProfileRecord => ({
  id: 'p', userId: 'u', characterId: 'c', rank: 1, danKhi: 0, furnaceLevel: 1, ...overrides,
});

const recipeT2 = {
  id: 'recipe-hoan-khi-dan', pillId: 'hoan-khi-dan', durationSec: 7200, linhThachCost: 60,
  active: true, tier: 2, minAlchemyRank: 4, baseSuccessPct: 75,
  ingredients: [{ materialId: 'nguyet-hoa-thao', quantity: 3 }],
};

function buildFakes(options: {
  profile?: AlchemyProfileRecord; realmMajor?: number; linhThach?: number;
  recipes?: typeof recipeT2[]; danHoaTuy?: number;
} = {}) {
  const state = { rankUpCalls: 0, furnaceCalls: 0, enqueueCalls: 0 };
  const alchemy = {
    listRecipes: async () => options.recipes ?? [recipeT2],
    getProfile: async () => options.profile ?? profile(),
    rankUp: async () => { state.rankUpCalls += 1; return profile(); },
    upgradeFurnace: async () => { state.furnaceCalls += 1; return profile(); },
    enqueue: async () => { state.enqueueCalls += 1; return { jobs: [], outputGrants: [] }; },
  };
  const characters = {
    findByUserId: async () => ({
      id: 'c', userId: 'u', realmMajor: options.realmMajor ?? 0, linhThach: options.linhThach ?? 0,
    }),
  };
  const materials = { listInventory: async () => [{ materialId: 'nguyet-hoa-thao', quantity: 99 }, ...(options.danHoaTuy ? [{ materialId: 'dan-hoa-tuy', quantity: options.danHoaTuy }] : [])] };
  return { alchemy, characters, materials, state };
}

// Fake OwnedCongPhapRepository trả rỗng / seed có buff Đan Đạo cho test preview.
function ownedFake(entries: { level: number; effects: { attribute: string; flatPerLevel: number; pctPerLevel: number }[] }[] = []) {
  return {
    listByUser: async () => entries.map((e) => ({
      def: { id: 'x', name: 'X', glyph: 'x', rarity: 3, category: 'passive', desc: 'd', active: true, maxLevel: 10, baseCost: 0, costGrowth: 1, effects: e.effects, powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 2, branch: 'danDao', minRealmMajor: 3, biTichMaterialId: 'bi-tich-x' },
      level: e.level, equippedSlot: null,
    })) as never,
  };
}
const EMPTY_OWNED = ownedFake();

describe('alchemy profile use cases', () => {
  it('GET profile trả bước kế tiếp cho rank và lò', async () => {
    const f = buildFakes({ profile: profile({ danKhi: 120 }), linhThach: 500 });
    const dto = await new GetAlchemyProfileUseCase(f.alchemy as never, f.characters as never, f.materials as never).execute('u');
    expect(dto.profile).toMatchObject({ rank: 1, danKhi: 120, furnaceLevel: 1 });
    expect(dto.nextRank).toMatchObject({ target: 2, danKhiCost: 100, affordable: true, locked: false });
    expect(dto.nextFurnace).toMatchObject({ target: 2, danKhiCost: 50, linhThachCost: 200, affordableDanKhi: true, affordableLinhThach: true });
  });

  it('nextRank null khi MAX_RANK, nextFurnace null khi lò max', async () => {
    const f = buildFakes({ profile: profile({ rank: 9, furnaceLevel: 5, danKhi: 9999 }) });
    const dto = await new GetAlchemyProfileUseCase(f.alchemy as never, f.characters as never, f.materials as never).execute('u');
    expect(dto.nextRank).toBeNull();
    expect(dto.nextFurnace).toBeNull();
  });

  it('nextRank cấp 7 mang chi phí Đan Hỏa Tủy và trạng thái tồn kho', async () => {
    const f = buildFakes({ profile: profile({ rank: 6, danKhi: 9999 }), realmMajor: 5 });
    const dto = await new GetAlchemyProfileUseCase(f.alchemy as never, f.characters as never, f.materials as never).execute('u');
    expect(dto.nextRank).toMatchObject({
      target: 7, danKhiCost: 3100, realmGateMajor: 5, realmMet: true,
      danHoaTuyCost: 1, danHoaTuyOwned: 0, affordableDanHoaTuy: false,
    });
    const rich = buildFakes({ profile: profile({ rank: 6, danKhi: 9999 }), realmMajor: 5, danHoaTuy: 1 });
    const dtoRich = await new GetAlchemyProfileUseCase(rich.alchemy as never, rich.characters as never, rich.materials as never).execute('u');
    expect(dtoRich.nextRank).toMatchObject({ danHoaTuyOwned: 1, affordableDanHoaTuy: true });
  });

  it('rank-up đủ điều kiện gọi repo, thiếu Đan Khí / cảnh giới / cap thì ném lỗi', async () => {
    const ok = buildFakes({ profile: profile({ danKhi: 100 }), realmMajor: 3 });
    await new RankUpAlchemyUseCase(ok.alchemy as never, ok.characters as never, ok.materials as never).execute('u');
    expect(ok.state.rankUpCalls).toBe(1);

    const poor = buildFakes({ profile: profile({ danKhi: 99 }), realmMajor: 9 });
    await expect(new RankUpAlchemyUseCase(poor.alchemy as never, poor.characters as never, poor.materials as never).execute('u'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_DAN_KHI' });

    const lowRealm = buildFakes({ profile: profile({ rank: 3, danKhi: 999 }), realmMajor: 2 });
    await expect(new RankUpAlchemyUseCase(lowRealm.alchemy as never, lowRealm.characters as never, lowRealm.materials as never).execute('u'))
      .rejects.toMatchObject({ code: 'ALCHEMY_REALM_GATE' });

    const noTuy = buildFakes({ profile: profile({ rank: 6, danKhi: 9999 }), realmMajor: 5 });
    await expect(new RankUpAlchemyUseCase(noTuy.alchemy as never, noTuy.characters as never, noTuy.materials as never).execute('u'))
      .rejects.toMatchObject({ code: 'ALCHEMY_MISSING_DAN_HOA_TUY' });
    expect(noTuy.state.rankUpCalls).toBe(0);

    const withTuy = buildFakes({ profile: profile({ rank: 6, danKhi: 3100 }), realmMajor: 5, danHoaTuy: 1 });
    await new RankUpAlchemyUseCase(withTuy.alchemy as never, withTuy.characters as never, withTuy.materials as never).execute('u');
    expect(withTuy.state.rankUpCalls).toBe(1);

    const capped = buildFakes({ profile: profile({ rank: 9, danKhi: 9999 }), realmMajor: 11 });
    await expect(new RankUpAlchemyUseCase(capped.alchemy as never, capped.characters as never, capped.materials as never).execute('u'))
      .rejects.toMatchObject({ code: 'ALCHEMY_RANK_LOCKED' });
  });

  it('upgrade lò thiếu Linh Thạch ném lỗi trước khi gọi repo', async () => {
    const f = buildFakes({ profile: profile({ danKhi: 999 }), linhThach: 10 });
    await expect(new UpgradeFurnaceUseCase(f.alchemy as never, f.characters as never).execute('u'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_LINH_THACH' });
    expect(f.state.furnaceCalls).toBe(0);
  });

  it('recipes player: locked khi rank thấp, effectiveSuccessPct tính theo profile', async () => {
    const f = buildFakes({ profile: profile({ rank: 5, furnaceLevel: 2 }) });
    const list = await new ListAlchemyRecipesUseCase(f.alchemy as never, EMPTY_OWNED as never).executeForUser('u');
    expect(list[0].locked).toBe(false);
    expect(list[0].effectiveSuccessPct).toBe(91); // 75 + (5−1)×3 + (2−1)×4
    expect(list[0].effectiveDurationSec).toBe(Math.round(7200 * (1 - (8 + 4) / 100)));

    const low = buildFakes({ profile: profile({ rank: 1 }) });
    const lockedList = await new ListAlchemyRecipesUseCase(low.alchemy as never, EMPTY_OWNED as never).executeForUser('u');
    expect(lockedList[0].locked).toBe(true);
  });

  it('enqueue rank thấp recipe tier cao → ALCHEMY_RANK_TOO_LOW, không enqueue', async () => {
    const f = buildFakes({ profile: profile({ rank: 1 }), linhThach: 9999 });
    await expect(new QueueAlchemyUseCase(f.alchemy as never, f.materials as never, f.characters as never)
      .execute('u', recipeT2.id, 1)).rejects.toMatchObject({ code: 'ALCHEMY_RANK_TOO_LOW' });
    expect(f.state.enqueueCalls).toBe(0);
  });
});

describe('ListAlchemyRecipesUseCase — buff Đan Đạo (Phase 2)', () => {
  it('sở hữu Điều Hỏa Tán Quyết lv 5 → effectiveSuccessPct tăng đúng 5 điểm', async () => {
    const f = buildFakes({ profile: profile({ rank: 5, furnaceLevel: 2 }) });
    const danDao = ownedFake([{ level: 5, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 1 }] }]);
    const list = await new ListAlchemyRecipesUseCase(f.alchemy as never, danDao as never).executeForUser('u');
    expect(list[0].effectiveSuccessPct).toBe(95); // 75 + 12 + 4 + 5 → clamp 95
  });

  it('môn danDao bị inactive không đóng góp', async () => {
    const f = buildFakes({ profile: profile({ rank: 5, furnaceLevel: 2 }) });
    const inactive = {
      listByUser: async () => [{
        def: { id: 'x', name: 'X', glyph: 'x', rarity: 3, category: 'passive', desc: 'd', active: false, maxLevel: 10, baseCost: 0, costGrowth: 1, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 2 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null, tier: 2, branch: 'danDao', minRealmMajor: 3, biTichMaterialId: 'bi-tich-x' },
        level: 10, equippedSlot: null,
      }],
    };
    const list = await new ListAlchemyRecipesUseCase(f.alchemy as never, inactive as never).executeForUser('u');
    expect(list[0].effectiveSuccessPct).toBe(91); // như không buff
  });

  it('recipe base 100 vẫn 100 (bonus không vượt nóc)', async () => {
    const t1 = { ...recipeT2, id: 'recipe-t1', tier: 1, minAlchemyRank: 1, baseSuccessPct: 100 };
    const f = buildFakes({ profile: profile({ rank: 5, furnaceLevel: 5 }), recipes: [t1] });
    const danDao = ownedFake([{ level: 10, effects: [{ attribute: 'danDaoSuccess', flatPerLevel: 0, pctPerLevel: 2 }] }]);
    const list = await new ListAlchemyRecipesUseCase(f.alchemy as never, danDao as never).executeForUser('u');
    expect(list[0].effectiveSuccessPct).toBe(100);
  });
});
