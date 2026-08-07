import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaExpeditionConfigRepository } from './PrismaExpeditionConfigRepository';
import { PrismaExpeditionRepository } from './PrismaExpeditionRepository';

const prisma = new PrismaClient();
const config = new PrismaExpeditionConfigRepository(prisma);
const expeditions = new PrismaExpeditionRepository(prisma);
let userId = '';

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  const user = await prisma.user.create({ data: { username: `exp_repo_${Date.now()}`, passwordHash: 'x' } });
  userId = user.id;
  await prisma.character.create({ data: { userId, linhThach: 100 } });
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.$disconnect();
});

const snapshot = {
  player: {
    id: 'player' as const,
    attributes: { khiHuyet: 100, chanNguyen: 100, congVatLy: 10, congPhep: 0, phongThu: 10, tocDo: 10 },
    battlePower: 100, maxChanNguyen: 100, skills: [],
  },
  realmMajor: 0, realmSub: 0, realmMultiplier: 1, realmReferencePower: 100,
};
const combatResult = { encounters: [], wins: 0 as const, reward: { multiplier: 0.25 as const, linhThach: 7, materials: [{ materialId: 'xich-viem-tinh', quantity: 2 }] } };
const reward = combatResult.reward;

describe('expedition Prisma repositories', () => {
  it('config đọc 8 branch và 24 difficulty', async () => {
    const rows = await config.listBranches();
    expect(rows).toHaveLength(8);
    expect(rows.reduce((sum, row) => sum + row.difficulties.length, 0)).toBe(24);
    expect(rows[0].branch.upgradeMaterialWeights).toHaveLength(4);
  });

  it('start trừ quota, completed giữ slot và claim grant reward idempotent', async () => {
    const now = new Date('2026-07-27T00:00:00Z');
    const started = await expeditions.start({
      userId, branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, ticketCostUnits: 1,
      gameDay: '2026-07-27', now, seed: 42, combatSnapshot: snapshot, combatResult, rewardResult: reward,
    });
    expect(started.status).toBe('running');
    const active = await expeditions.start({
      userId, branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, ticketCostUnits: 1,
      gameDay: '2026-07-27', now, seed: 43, combatSnapshot: snapshot, combatResult, rewardResult: reward,
    }).catch((error) => error);
    expect(active.code).toBe('EXPEDITION_ACTIVE');

    const current = await expeditions.getCurrent(userId, new Date('2026-07-27T00:30:00Z'));
    expect(current.expedition?.status).toBe('completed');
    expect(current.remainingUnits).toBe(11);

    const claimed = await expeditions.claim(userId, new Date('2026-07-27T00:30:00Z'));
    expect(claimed.reward).toEqual(reward);
    expect((await prisma.character.findUniqueOrThrow({ where: { userId } })).linhThach).toBe(107);
    expect((await prisma.materialInventory.findUniqueOrThrow({ where: { userId_materialId: { userId, materialId: 'xich-viem-tinh' } } })).quantity).toBe(2);

    const repeated = await expeditions.claim(userId, new Date('2026-07-27T00:30:01Z')).catch((error) => error);
    expect(repeated.code).toBe('EXPEDITION_ALREADY_CLAIMED');
  });
});
