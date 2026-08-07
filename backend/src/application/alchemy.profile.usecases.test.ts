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
  recipes?: typeof recipeT2[];
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
  const materials = { listInventory: async () => [{ materialId: 'nguyet-hoa-thao', quantity: 99 }] };
  return { alchemy, characters, materials, state };
}

describe('alchemy profile use cases', () => {
  it('GET profile trả bước kế tiếp cho rank và lò', async () => {
    const f = buildFakes({ profile: profile({ danKhi: 120 }), linhThach: 500 });
    const dto = await new GetAlchemyProfileUseCase(f.alchemy as never, f.characters as never).execute('u');
    expect(dto.profile).toMatchObject({ rank: 1, danKhi: 120, furnaceLevel: 1 });
    expect(dto.nextRank).toMatchObject({ target: 2, danKhiCost: 100, affordable: true, locked: false });
    expect(dto.nextFurnace).toMatchObject({ target: 2, danKhiCost: 50, linhThachCost: 200, affordableDanKhi: true, affordableLinhThach: true });
  });

  it('nextRank null khi MAX_RANK, nextFurnace null khi lò max', async () => {
    const f = buildFakes({ profile: profile({ rank: 6, furnaceLevel: 5, danKhi: 9999 }) });
    const dto = await new GetAlchemyProfileUseCase(f.alchemy as never, f.characters as never).execute('u');
    expect(dto.nextRank).toBeNull();
    expect(dto.nextFurnace).toBeNull();
  });

  it('rank-up đủ điều kiện gọi repo, thiếu Đan Khí / cảnh giới / cap thì ném lỗi', async () => {
    const ok = buildFakes({ profile: profile({ danKhi: 100 }), realmMajor: 3 });
    await new RankUpAlchemyUseCase(ok.alchemy as never, ok.characters as never).execute('u');
    expect(ok.state.rankUpCalls).toBe(1);

    const poor = buildFakes({ profile: profile({ danKhi: 99 }), realmMajor: 9 });
    await expect(new RankUpAlchemyUseCase(poor.alchemy as never, poor.characters as never).execute('u'))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_DAN_KHI' });

    const lowRealm = buildFakes({ profile: profile({ rank: 3, danKhi: 999 }), realmMajor: 2 });
    await expect(new RankUpAlchemyUseCase(lowRealm.alchemy as never, lowRealm.characters as never).execute('u'))
      .rejects.toMatchObject({ code: 'ALCHEMY_REALM_GATE' });

    const capped = buildFakes({ profile: profile({ rank: 6, danKhi: 9999 }), realmMajor: 11 });
    await expect(new RankUpAlchemyUseCase(capped.alchemy as never, capped.characters as never).execute('u'))
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
    const list = await new ListAlchemyRecipesUseCase(f.alchemy as never).executeForUser('u');
    expect(list[0].locked).toBe(false);
    expect(list[0].effectiveSuccessPct).toBe(91); // 75 + (5−1)×3 + (2−1)×4
    expect(list[0].effectiveDurationSec).toBe(Math.round(7200 * (1 - (8 + 4) / 100)));

    const low = buildFakes({ profile: profile({ rank: 1 }) });
    const lockedList = await new ListAlchemyRecipesUseCase(low.alchemy as never).executeForUser('u');
    expect(lockedList[0].locked).toBe(true);
  });

  it('enqueue rank thấp recipe tier cao → ALCHEMY_RANK_TOO_LOW, không enqueue', async () => {
    const f = buildFakes({ profile: profile({ rank: 1 }), linhThach: 9999 });
    await expect(new QueueAlchemyUseCase(f.alchemy as never, f.materials as never, f.characters as never)
      .execute('u', recipeT2.id, 1)).rejects.toMatchObject({ code: 'ALCHEMY_RANK_TOO_LOW' });
    expect(f.state.enqueueCalls).toBe(0);
  });
});
