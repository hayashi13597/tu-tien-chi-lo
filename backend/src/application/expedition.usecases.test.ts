import { describe, expect, it } from 'vitest';
import { DomainError } from '../domain/errors';
import { StartExpeditionUseCase } from './StartExpeditionUseCase';
import { GetCurrentExpeditionUseCase } from './GetCurrentExpeditionUseCase';
import { ClaimExpeditionUseCase } from './ClaimExpeditionUseCase';

const branch = {
  id: 'hoa-vuc', name: 'Hỏa Vực', glyph: '火', description: 'd', basePower: 10,
  alchemyMaterialId: 'xich-viem-tinh',
  upgradeMaterialWeights: [{ materialId: 'linh-tai-khi-huyet', weight: 1 }, { materialId: 'linh-tai-than-phap', weight: 1 }, { materialId: 'linh-tai-hoa-luc', weight: 1 }],
  tier: 1, minRealmMajor: 0, recommendedPower: 0, bossDropWeights: [],
};
const difficulty = {
  key: 'easy' as const, enemyMultiplier: 0.8, normalDropRate: 0.5, bossDropRate: 0.7, rewardMultiplier: 0.8, adaptiveCoefficient: 0.1,
};
const state = {
  realmMajor: 0, realmSub: 0, linhThach: 100, battlePower: 100,
  attributes: { base: { khiHuyet: 100, chanNguyen: 100, congVatLy: 20, congPhep: 0, phongThu: 10, tocDo: 20 }, final: { khiHuyet: 100, chanNguyen: 100, congVatLy: 20, congPhep: 0, phongThu: 10, tocDo: 20 } },
};

function buildFakes(options: { startError?: string; pillsCatalog?: Record<string, unknown>; branchOverrides?: Record<string, unknown>; stateOverrides?: Record<string, unknown> } = {}) {
  let starts = 0;
  let currentCalls = 0;
  const expedition = {
    id: 'exp-1', userId: 'u', branchId: branch.id, difficulty: difficulty.key, durationSec: 1_800,
    ticketCostUnits: 1, status: 'running', claimedAt: null,
  };
  const repo = {
    start: async (input: unknown) => {
      starts += 1;
      if (options.startError) throw new DomainError(options.startError, options.startError);
      return { ...expedition, input };
    },
    getCurrent: async () => { currentCalls += 1; return { expedition, gameDay: '2026-07-27', spentUnits: 1, remainingUnits: 11 }; },
    claim: async () => ({ expedition: { ...expedition, status: 'claimed' }, reward: { linhThach: 10, materials: [] } }),
  };
  const effectiveBranch = { ...branch, ...options.branchOverrides };
  const config = {
    getBranch: async (id: string) => id === effectiveBranch.id ? { branch: effectiveBranch, difficulties: [difficulty] } : null,
    listBranches: async () => [{ branch: effectiveBranch, difficulties: [difficulty] }],
  };
  const cultivation = { execute: async () => ({ ...state, ...options.stateOverrides }) };
  const owned = { listByUser: async () => [] };
  const pills = { listByIds: async (ids: string[]) => options.pillsCatalog ? ids.map((id) => options.pillsCatalog?.[id]).filter(Boolean) : [] };
  const realmConfig = { get: () => ({ realmName: (major: number) => ['Phàm Nhân', 'Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần'][major] ?? `major ${major}` }) };
  const random = { next: () => 0.1 };
  return { repo, config, cultivation, owned, pills, realmConfig, random, expedition, get starts() { return starts; }, get currentCalls() { return currentCalls; } };
}

describe('expedition use cases', () => {
  it('chặn start khi thiếu cảnh giới, message mang tên cảnh giới gate', async () => {
    const f = buildFakes({ branchOverrides: { tier: 2, minRealmMajor: 3 } });
    const useCase = new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await expect(useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 }))
      .rejects.toMatchObject({ code: 'EXPEDITION_REALM_GATE', message: 'Tầng 2 yêu cầu cảnh giới Kết Đan' });
    expect(f.starts).toBe(0);
  });

  it('tầng 2: đủ cảnh giới (realmMajor 3) thì start được', async () => {
    const f = buildFakes({ branchOverrides: { tier: 2, minRealmMajor: 3 }, stateOverrides: { realmMajor: 3 } });
    const useCase = new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await expect(useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 })).resolves.toBeTruthy();
    expect(f.starts).toBe(1);
  });

  it('loadout hợp lệ: snapshot ghi loadout + repo nhận loadoutConsumptions', async () => {
    const combatPill = {
      id: 'cuong-the-dan', name: 'Cường Thể Đan', glyph: '強', rarity: 3, tier: 2, effectKind: 'combatBuff',
      amount: null, multiplier: null, durationSec: null, bonusPct: 25,
      combatAttribute: 'congVatLy', combatTrigger: 'start', desc: 'd', active: true, starterQuantity: 0,
    };
    const f = buildFakes({ pillsCatalog: { 'cuong-the-dan': combatPill } });
    let captured: { combatSnapshot?: { loadout?: unknown }; loadoutConsumptions?: unknown } = {};
    const repoWatch = {
      ...f.repo,
      start: async (input: { combatSnapshot?: { loadout?: unknown }; loadoutConsumptions?: unknown }) => { captured = input; return f.repo.start(input); },
    };
    const useCase = new StartExpeditionUseCase(f.config as never, repoWatch as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800, loadoutPillIds: ['cuong-the-dan'] });
    expect(captured.combatSnapshot?.loadout).toEqual([{ pillId: 'cuong-the-dan', combatAttribute: 'congVatLy', combatTrigger: 'start', pct: 25 }]);
    expect(captured.loadoutConsumptions).toEqual([{ pillId: 'cuong-the-dan', quantity: 1 }]);
  });

  it.each([
    ['đan id không tồn tại', {}],
    ['đan không phải combatBuff', { 'hoi-khi-dan': { id: 'hoi-khi-dan', name: 'x', glyph: 'x', rarity: 0, tier: 1, effectKind: 'linhKhi', amount: 50, multiplier: null, durationSec: null, bonusPct: null, combatAttribute: null, combatTrigger: null, desc: 'd', active: true, starterQuantity: 0 } }],
  ])('LOADOUT_INVALID khi %s', async (_label, pillsCatalog) => {
    const f = buildFakes({ pillsCatalog });
    const useCase = new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await expect(useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800, loadoutPillIds: Object.keys(pillsCatalog).length ? Object.keys(pillsCatalog) : ['khong-ton-tai'] }))
      .rejects.toMatchObject({ code: 'LOADOUT_INVALID' });
    expect(f.starts).toBe(0);
  });

  it('không loadout → snapshot không có loadout, consumptions rỗng', async () => {
    const f = buildFakes();
    let captured: { combatSnapshot?: { loadout?: unknown }; loadoutConsumptions?: unknown } = {};
    const repoWatch = {
      ...f.repo,
      start: async (input: { combatSnapshot?: { loadout?: unknown }; loadoutConsumptions?: unknown }) => { captured = input; return f.repo.start(input); },
    };
    const useCase = new StartExpeditionUseCase(f.config as never, repoWatch as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 });
    expect(captured.combatSnapshot?.loadout).toBeUndefined();
    expect(captured.loadoutConsumptions).toEqual([]);
  });

  it('thiếu điểm trả INSUFFICIENT_EXPEDITION_TICKETS và không gọi start thành công', async () => {
    const f = buildFakes({ startError: 'INSUFFICIENT_EXPEDITION_TICKETS' });
    const useCase = new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await expect(useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 })).rejects.toMatchObject({ code: 'INSUFFICIENT_EXPEDITION_TICKETS' });
    expect(f.starts).toBe(1);
  });

  it('running hoặc completed chưa claim trả EXPEDITION_ACTIVE', async () => {
    const f = buildFakes({ startError: 'EXPEDITION_ACTIVE' });
    const useCase = new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    await expect(useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 })).rejects.toMatchObject({ code: 'EXPEDITION_ACTIVE' });
  });

  it('start thành công snapshot combat, roll reward và consume cost theo duration', async () => {
    const f = buildFakes();
    const result = await new StartExpeditionUseCase(f.config as never, f.repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never)
      .execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 7_200 }, new Date('2026-07-27T00:00:00Z'));
    const started = result as unknown as { input: { ticketCostUnits: number; branchId: string; difficulty: string; combatSnapshot: unknown; rewardResult: unknown } };
    expect(started.input).toMatchObject({ ticketCostUnits: 2, branchId: branch.id, difficulty: 'easy' });
    expect(started.input.combatSnapshot).toBeTruthy();
    expect(started.input.rewardResult).toBeTruthy();
  });

  it('claim chuyển reward sau complete và lần hai bị từ chối', async () => {
    const f = buildFakes();
    const useCase = new ClaimExpeditionUseCase(f.repo as never);
    const result = await useCase.execute('u', new Date('2026-07-27T02:00:00Z'));
    expect(result.reward.linhThach).toBe(10);
    const second = buildFakes({ startError: 'EXPEDITION_ALREADY_CLAIMED' });
    const secondClaim = new ClaimExpeditionUseCase({ claim: async () => { throw new DomainError('EXPEDITION_ALREADY_CLAIMED', 'claimed'); } } as never);
    await expect(secondClaim.execute('u')).rejects.toMatchObject({ code: 'EXPEDITION_ALREADY_CLAIMED' });
    expect(second).toBeTruthy();
  });

  it('GET current settle timer nhưng không tự claim', async () => {
    const f = buildFakes();
    const result = await new GetCurrentExpeditionUseCase(f.repo as never).execute('u', new Date('2026-07-27T02:00:00Z'));
    expect(result.expedition!.status).toBe('running');
    expect(f.currentCalls).toBe(1);
  });

  it('race start để repository quyết định chỉ một transaction thắng', async () => {
    let calls = 0;
    const repo = { start: async () => { calls += 1; if (calls > 1) throw new DomainError('CONCURRENT_MODIFICATION', 'race'); return {}; } };
    const f = buildFakes();
    const useCase = new StartExpeditionUseCase(f.config as never, repo as never, f.cultivation as never, f.owned as never, f.pills as never, f.realmConfig as never, f.random as never);
    const results = await Promise.allSettled([
      useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 }),
      useCase.execute('u', { branchId: branch.id, difficulty: 'easy', durationSec: 1_800 }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });
});
