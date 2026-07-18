import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeAll(async () => {
  // The buff/boost tests consume real pills, which requires the catalog seeded.
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /cultivation/state', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/cultivation/state');
    expect(res.status).toBe(401);
  });

  it('returns the starting state for a freshly registered character', async () => {
    const token = await registerAndLogin('fiona');
    const res = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.realmName).toBe('Phàm Nhân - Sơ Kỳ');
    expect(res.body.linhKhiRequired).toBe(100);
    expect(res.body.canBreakthrough).toBe(false);
    expect(res.body.isMaxStage).toBe(false);
    // Fresh Phàm Nhân - Sơ: base rate, no pity, no boost.
    expect(res.body.breakthroughSuccessRate).toBe(90);
  });

  it('does not write to the database on repeated calls', async () => {
    const token = await registerAndLogin('george');
    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const before = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    const after = await prisma.character.findFirst({ where: { user: { username: 'george' } } });

    expect(after?.lastUpdateAt.getTime()).toBe(before?.lastUpdateAt.getTime());
  });

  it('exposes buff and boost fields (null/0 for a fresh character)', async () => {
    const token = await registerAndLogin('buff-fresh');
    const res = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cultivationBuffMultiplier).toBeNull();
    expect(res.body.cultivationBuffUntil).toBeNull();
    expect(res.body.breakthroughBonusPct).toBe(0);
  });

  it('reflects a consumed cultivation buff and boost in the state', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ username: 'buff-active', password: 'password123' });
    await agent.post('/pills/consume').send({ pillId: 'tinh-tam-dan' }); // ×1.5, 120s
    await agent.post('/pills/consume').send({ pillId: 'pha-canh-dan' }); // +15%
    const res = await agent.get('/cultivation/state');
    expect(res.body.cultivationBuffMultiplier).toBe(1.5);
    expect(typeof res.body.cultivationBuffUntil).toBe('string'); // ISO
    expect(res.body.breakthroughBonusPct).toBe(15);
    // Phàm Nhân - Sơ base 90 + 15% boost = 105, clamped to the stage cap 95.
    expect(res.body.breakthroughSuccessRate).toBe(95);
  });
});
