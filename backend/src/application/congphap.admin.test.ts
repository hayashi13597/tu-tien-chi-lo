import { describe, it, expect } from 'vitest';
import { CreateCongPhapUseCase } from './CreateCongPhapUseCase';
import { UpdateCongPhapUseCase } from './UpdateCongPhapUseCase';
import { GrantUseCase } from './GrantUseCase';
import { CongPhapRecord } from '../domain/congphap/congphap';

const valid: CongPhapRecord = { id: 'new-cp', name: 'N', glyph: 'n', rarity: 1, category: 'passive', desc: 'd', active: true, maxLevel: 5, baseCost: 100, costGrowth: 1.5, effects: [{ attribute: 'tocDo', flatPerLevel: 1, pctPerLevel: 0 }], powerPerLevel: null, chanNguyenCost: null, dupRefundLinhThach: null, upgradeMaterialId: null, baseMaterialCost: 0, materialCostGrowth: 1, cooldownRounds: null };

function repoFakes(existing: CongPhapRecord[] = []) {
  const m = new Map(existing.map((d) => [d.id, d]));
  return {
    findById: async (id: string) => m.get(id) ?? null,
    listActive: async () => [...m.values()].filter((d) => d.active),
    listAll: async () => [...m.values()],
    create: async (d: CongPhapRecord) => { m.set(d.id, d); },
    update: async (d: CongPhapRecord) => { if (!m.has(d.id)) return false; m.set(d.id, d); return true; },
  };
}

describe('CreateCongPhapUseCase', () => {
  it('validate rồi tạo', async () => {
    const repo = repoFakes();
    const r = await new CreateCongPhapUseCase(repo as never).execute(valid);
    expect(r.id).toBe('new-cp');
  });
  it('id trùng -> CONGPHAP_ID_TAKEN', async () => {
    const repo = repoFakes([valid]);
    await expect(new CreateCongPhapUseCase(repo as never).execute(valid)).rejects.toMatchObject({ code: 'CONGPHAP_ID_TAKEN' });
  });
  it('config sai -> INVALID_CONGPHAP_CONFIG', async () => {
    const repo = repoFakes();
    await expect(new CreateCongPhapUseCase(repo as never).execute({ ...valid, effects: [] })).rejects.toMatchObject({ code: 'INVALID_CONGPHAP_CONFIG' });
  });
});

describe('UpdateCongPhapUseCase', () => {
  it('không tồn tại -> CONGPHAP_NOT_FOUND', async () => {
    const repo = repoFakes();
    await expect(new UpdateCongPhapUseCase(repo as never).execute(valid)).rejects.toMatchObject({ code: 'CONGPHAP_NOT_FOUND' });
  });
});

describe('GrantUseCase', () => {
  it('grant congphap + linhThach', async () => {
    let added = 0; const granted: string[] = [];
    const owned = { grant: async (_u: string, id: string) => { granted.push(id); return true; } };
    const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async (_id: string, a: number) => { added += a; } };
    await new GrantUseCase(owned as never, chars as never).execute({ userId: 'u', congPhapId: 'x', linhThach: 500 });
    expect(granted).toEqual(['x']);
    expect(added).toBe(500);
  });
  it('không có gì để cấp -> lỗi', async () => {
    const owned = { grant: async () => true };
    const chars = { findByUserId: async () => ({ id: 'c' } as never), addLinhThach: async () => {} };
    await expect(new GrantUseCase(owned as never, chars as never).execute({ userId: 'u' })).rejects.toMatchObject({ code: 'INVALID_GRANT' });
  });
});
