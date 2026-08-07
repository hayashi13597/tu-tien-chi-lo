import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();
const username = `route_exp_${Date.now()}`;
let userId = '';

beforeAll(() => {
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username } });
  await prisma.$disconnect();
});

describe('expedition routes', () => {
  it('yêu cầu auth và trả catalog 8 nhánh', async () => {
    expect((await request(app).get('/expeditions/branches')).status).toBe(401);
    const agent = request.agent(app);
    expect((await agent.post('/auth/register').send({ username, password: 'password123' })).status).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    userId = user.id;
    const branches = await agent.get('/expeditions/branches');
    expect(branches.status).toBe(200);
    expect(branches.body).toHaveLength(8);
  });

  it('start/current/claim giữ slot và claim idempotent', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username, password: 'password123' });
    const invalid = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 60 });
    expect(invalid.status).toBe(400);

    const started = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800 });
    expect(started.status).toBe(200);
    expect(started.body.ticketCostUnits).toBe(1);
    const current = await agent.get('/expeditions/current');
    expect(current.body.remainingUnits).toBe(11);
    expect(current.body.expedition.status).toBe('running');

    const active = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800 });
    expect(active.status).toBe(409);
    expect(active.body.error.code).toBe('EXPEDITION_ACTIVE');

    await prisma.expedition.updateMany({ where: { userId, status: 'running' }, data: { completesAt: new Date(Date.now() - 1_000) } });
    const claimed = await agent.post('/expeditions/claim');
    expect(claimed.status).toBe(200);
    const repeated = await agent.post('/expeditions/claim');
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('EXPEDITION_ALREADY_CLAIMED');
  });

  it('Phase 3: branches trả tier/gate/recommendedPower/bossDropWeights', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username, password: 'password123' });
    const branches = await agent.get('/expeditions/branches');
    expect(branches.status).toBe(200);
    const thanhLam = branches.body.find((b: { branch: { id: string } }) => b.branch.id === 'thanh-lam');
    expect(thanhLam.branch.tier).toBe(2);
    expect(thanhLam.branch.minRealmMajor).toBe(3);
    expect(thanhLam.branch.recommendedPower).toBe(600);
    expect(thanhLam.branch.bossDropWeights.length).toBeGreaterThan(0);
    const hoaVuc = branches.body.find((b: { branch: { id: string } }) => b.branch.id === 'hoa-vuc');
    expect(hoaVuc.branch.tier).toBe(1);
    expect(hoaVuc.branch.bossDropWeights).toHaveLength(0);
  });

  it('Phase 3: start tầng 2 khi cảnh giới thấp → 409 EXPEDITION_REALM_GATE', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username, password: 'password123' });
    // user mới Phàm Nhân (realmMajor 0) < gate 3 của thanh-lam
    const res = await agent.post('/expeditions/start').send({ branchId: 'thanh-lam', difficulty: 'easy', durationSec: 1_800 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EXPEDITION_REALM_GATE');
    expect(res.body.error.message).toContain('Kết Đan');
  });

  it('Phase 3: zod chặn loadout > 2 hay trùng id', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ username, password: 'password123' });
    for (const ids of [['a', 'b', 'c'], ['a', 'a']]) {
      const res = await agent.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, loadoutPillIds: ids });
      expect(res.status).toBe(400);
    }
  });

  it('Phase 3: start với đan combatBuff trừ kho, đan linhKhi → 400', async () => {
    const user2 = `route_exp2_${Date.now()}`;
    const agent2 = request.agent(app);
    expect((await agent2.post('/auth/register').send({ username: user2, password: 'password123' })).status).toBe(201);
    const u2 = await prisma.user.findUniqueOrThrow({ where: { username: user2 } });
    // cấp đan thủ công
    await prisma.inventoryItem.create({ data: { userId: u2.id, pillId: 'cuong-the-dan', quantity: 1 } });
    await prisma.inventoryItem.create({ data: { userId: u2.id, pillId: 'hoi-khi-dan', quantity: 1 } });
    // nhánh tầng 1 không gate; battlePower < recommendedPower = 0 → soft, vẫn start
    const wrong = await agent2.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, loadoutPillIds: ['hoi-khi-dan'] });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('LOADOUT_INVALID');
    const started = await agent2.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, loadoutPillIds: ['cuong-the-dan'] });
    expect(started.status).toBe(200);
    expect(started.body.combatSnapshot.loadout).toEqual([{ pillId: 'cuong-the-dan', combatAttribute: 'congVatLy', combatTrigger: 'start', pct: 25 }]);
    const inv = await prisma.inventoryItem.findUnique({ where: { userId_pillId: { userId: u2.id, pillId: 'cuong-the-dan' } } });
    expect(inv?.quantity).toBe(0);
    // hết đan → start lại loadout → 409 INSUFFICIENT_INVENTORY
    await prisma.expedition.deleteMany({ where: { userId: u2.id } });
    const again = await agent2.post('/expeditions/start').send({ branchId: 'hoa-vuc', difficulty: 'easy', durationSec: 1_800, loadoutPillIds: ['cuong-the-dan'] });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INSUFFICIENT_INVENTORY');
    await prisma.user.deleteMany({ where: { username: user2 } });
  });
});
