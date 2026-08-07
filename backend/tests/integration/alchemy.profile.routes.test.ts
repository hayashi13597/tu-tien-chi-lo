import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

// random = 0.99 → mọi roll1 đều >= successPct < 99 (fail); dùng cho flow fail deterministic.
const app = createApp({ randomSource: { next: () => 0.99 } });
const username = `alchemy2_${Date.now()}`;

const agent = request.agent(app);

beforeAll(async () => {
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  expect((await agent.post('/auth/register').send({ username, password: 'password123' })).status).toBe(201);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username } });
  await prisma.$disconnect();
});

async function grantMaterials(userId: string) {
  const character = await prisma.character.findUniqueOrThrow({ where: { userId } });
  await prisma.character.update({ where: { id: character.id }, data: { linhThach: 10_000 } });
  for (const materialId of ['nguyet-hoa-thao', 'loi-minh-thach', 'xich-viem-tinh']) {
    await prisma.materialInventory.upsert({
      where: { userId_materialId: { userId, materialId } },
      create: { userId, materialId, quantity: 500 },
      update: { quantity: 500 },
    });
  }
  return character;
}

describe('alchemy 2.0 routes', () => {
  // Lưu ý: các it trong file là MỘT flow tuần tự dùng chung user (grantMaterials ở ca trước phục vụ ca sau) — không chạy lẻ bằng .only/-t.
  it('endpoint mới yêu cầu auth', async () => {
    expect((await request(app).get('/alchemy/profile')).status).toBe(401);
    expect((await request(app).post('/alchemy/rank-up')).status).toBe(401);
    expect((await request(app).post('/alchemy/furnace/upgrade')).status).toBe(401);
  });

  it('GET /alchemy/profile lazy-create rank 1 và trả bước kế tiếp', async () => {
    const res = await agent.get('/alchemy/profile');
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ rank: 1, danKhi: 0, furnaceLevel: 1 });
    expect(res.body.nextRank).toMatchObject({ target: 2, danKhiCost: 100, realmMet: true, affordable: false });
    expect(res.body.nextFurnace).toMatchObject({ target: 2, danKhiCost: 50 });
  });

  it('rank-up thiếu Đan Khí trả 409 INSUFFICIENT_DAN_KHI', async () => {
    const res = await agent.post('/alchemy/rank-up');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_DAN_KHI');
  });

  it('enqueue tier 2 khi rank 1 trả 409 ALCHEMY_RANK_TOO_LOW', async () => {
    const me = await agent.get('/auth/me');
    await grantMaterials(me.body.id);
    const res = await agent.post('/alchemy/queue').send({ recipeId: 'recipe-hoan-khi-dan', quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALCHEMY_RANK_TOO_LOW');
  });

  it('lên rank 4 cần Kết Đan; sau đó enqueue tier 2 + settle fail có refund + Đan Khí', async () => {
    const me = await agent.get('/auth/me');
    const userId = me.body.id as string;
    const character = await prisma.character.update({
      where: { userId }, data: { realmMajor: 3 },
    });
    await prisma.alchemyProfile.update({
      where: { userId }, data: { rank: 3, danKhi: 5000 },
    });
    expect((await agent.post('/alchemy/rank-up')).status).toBe(200);

    const enq = await agent.post('/alchemy/queue').send({ recipeId: 'recipe-hoan-khi-dan', quantity: 2 });
    expect(enq.status).toBe(200);

    await prisma.alchemyJob.updateMany({
      where: { userId }, data: { completesAt: new Date(Date.now() - 1000) },
    });
    const before = await prisma.character.findUniqueOrThrow({ where: { id: character.id } });
    const queue = await agent.get('/alchemy/queue');
    expect(queue.status).toBe(200);
    expect(queue.body.outputGrants).toEqual([]);

    const job = queue.body.jobs.find((j: { recipeId: string }) => j.recipeId === 'recipe-hoan-khi-dan');
    expect(job).toMatchObject({ successCount: 0, failCount: 2, critCount: 0 });

    const profile = await agent.get('/alchemy/profile');
    // danKhi: 5000 − 700 (rank-up 3→4) + 4 (2 đơn vị hỏng tier 2 × 2 ĐK)
    expect(profile.body.profile.danKhi).toBe(5000 - 700 + 4);
    const after = await prisma.character.findUniqueOrThrow({ where: { id: character.id } });
    expect(after.linhThach).toBe(before.linhThach + Math.floor(60 * 0.3) * 2);
  });

  it('rank-up khi thiếu cảnh giới trả 409 ALCHEMY_REALM_GATE', async () => {
    const me = await agent.get('/auth/me');
    const userId = me.body.id as string;
    await prisma.character.update({ where: { userId }, data: { realmMajor: 2 } });
    await prisma.alchemyProfile.update({ where: { userId }, data: { rank: 3, danKhi: 5000 } });
    const res = await agent.post('/alchemy/rank-up');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALCHEMY_REALM_GATE');
  });

  it('upgrade furnace trừ Đan Khí + Linh Thạch; max lò trả 409 ALCHEMY_FURNACE_MAX', async () => {
    const me = await agent.get('/auth/me');
    const userId = me.body.id as string;
    await prisma.alchemyProfile.update({ where: { userId }, data: { danKhi: 5000, furnaceLevel: 1 } });
    const before = await prisma.character.findUniqueOrThrow({ where: { userId } });
    const res = await agent.post('/alchemy/furnace/upgrade');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ furnaceLevel: 2, danKhi: 4950 });
    const after = await prisma.character.findUniqueOrThrow({ where: { userId } });
    expect(before.linhThach - after.linhThach).toBe(200);

    await prisma.alchemyProfile.update({ where: { userId }, data: { danKhi: 5000, furnaceLevel: 5 } });
    const maxRes = await agent.post('/alchemy/furnace/upgrade');
    expect(maxRes.status).toBe(409);
    expect(maxRes.body.error.code).toBe('ALCHEMY_FURNACE_MAX');
  });

  it('upgrade furnace thiếu Linh Thạch trả 409 INSUFFICIENT_LINH_THACH', async () => {
    const me = await agent.get('/auth/me');
    const userId = me.body.id as string;
    await prisma.character.update({ where: { userId }, data: { linhThach: 0 } });
    await prisma.alchemyProfile.update({ where: { userId }, data: { furnaceLevel: 1, danKhi: 5000 } });
    const res = await agent.post('/alchemy/furnace/upgrade');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_LINH_THACH');
  });
});
