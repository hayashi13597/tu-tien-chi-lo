import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}
async function registerAdminAndLogin(username: string) {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const r = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return r.headers['set-cookie'] as string[];
}

function redeemBody(over: Record<string, unknown> = {}) {
  return { id: 'rt-code-1', code: 'RTEST', active: true, maxRedemptions: 5, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 2 }], ...over };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'RTEST' } } });
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'RTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'RTEST' } } });
  await prisma.$disconnect();
});

describe('POST /redeem', () => {
  it('returns 401 without auth', async () => {
    expect((await request(app).post('/redeem').send({ code: 'X' })).status).toBe(401);
  });

  it('returns 404 for unknown code', async () => {
    const cookies = await registerAndLogin('rtu1');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'UNKNOWN' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REDEEM_CODE_NOT_FOUND');
  });

  it('grants rewards and returns enriched result', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody());
    const cookies = await registerAndLogin('rt-player');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'rtest' }); // lowercase — normalized
    expect(res.status).toBe(200);
    expect(res.body.rewards[0].pillId).toBe('hoi-khi-dan');
    expect(res.body.rewards[0].quantity).toBe(2);
    const inv = await request(app).get('/pills/inventory').set('Cookie', cookies);
    const item = inv.body.find((i: { id: string }) => i.id === 'hoi-khi-dan');
    expect(item?.quantity).toBeGreaterThanOrEqual(2);
  });

  it('returns 409 REDEEM_CODE_ALREADY_USED on second attempt', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin2');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody());
    const cookies = await registerAndLogin('rt-player2');
    await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    const res2 = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('REDEEM_CODE_ALREADY_USED');
  });

  it('returns 409 REDEEM_CODE_EXHAUSTED when cap reached', async () => {
    const adminCookies = await registerAdminAndLogin('rt-admin3');
    await request(app).post('/admin/codes').set('Cookie', adminCookies).send(redeemBody({ maxRedemptions: 1 }));
    const c1 = await registerAndLogin('rt-p3a');
    const c2 = await registerAndLogin('rt-p3b');
    await request(app).post('/redeem').set('Cookie', c1).send({ code: 'RTEST' });
    const res = await request(app).post('/redeem').set('Cookie', c2).send({ code: 'RTEST' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REDEEM_CODE_EXHAUSTED');
  });
});
