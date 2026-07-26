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
    expect(res.body.rewards[0].kind).toBe('pill');
    expect(res.body.rewards[0].id).toBe('hoi-khi-dan');
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

  it('grants a công pháp reward, and refunds Linh Thạch on a duplicate', async () => {
    const adminCookies = await registerAdminAndLogin('rt-cp-admin');
    const created = await request(app).post('/admin/codes').set('Cookie', adminCookies)
      .send(redeemBody({ rewards: [{ congPhapId: 'thiet-cot-quyet', quantity: 1 }] }));
    expect(created.status).toBe(201);

    const cookies = await registerAndLogin('rt-cp-player');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    expect(res.status).toBe(200);
    expect(res.body.rewards[0].kind).toBe('congphap');
    expect(res.body.rewards[0].id).toBe('thiet-cot-quyet');

    const owned = await request(app).get('/congphap').set('Cookie', cookies);
    expect(owned.body.owned.map((o: { def: { id: string } }) => o.def.id)).toContain('thiet-cot-quyet');

    // Second code granting the same công pháp converts to Linh Thạch instead.
    await request(app).post('/admin/codes').set('Cookie', adminCookies)
      .send(redeemBody({ id: 'rt-code-dup', code: 'RTESTDUP', rewards: [{ congPhapId: 'thiet-cot-quyet', quantity: 1 }] }));
    const dup = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTESTDUP' });
    expect(dup.status).toBe(200);
    expect(dup.body.rewards[0].kind).toBe('linhThach');
    // thiet-cot-quyet has no dupRefundLinhThach, so the refund falls back to baseCost (100).
    expect(dup.body.rewards[0].quantity).toBe(100);

    const state = await request(app).get('/cultivation/state').set('Cookie', cookies);
    expect(state.body.linhThach).toBe(100);
  });

  it('grants a direct Linh Thạch reward', async () => {
    const adminCookies = await registerAdminAndLogin('rt-lt-admin');
    await request(app).post('/admin/codes').set('Cookie', adminCookies)
      .send(redeemBody({ rewards: [{ linhThach: 5000, quantity: 1 }] }));

    const cookies = await registerAndLogin('rt-lt-player');
    const res = await request(app).post('/redeem').set('Cookie', cookies).send({ code: 'RTEST' });
    expect(res.status).toBe(200);
    expect(res.body.rewards[0].kind).toBe('linhThach');
    expect(res.body.rewards[0].quantity).toBe(5000);

    const state = await request(app).get('/cultivation/state').set('Cookie', cookies);
    expect(state.body.linhThach).toBe(5000);
  });

  it('rejects a reward that mixes two kinds (400 INVALID_REDEEM_CODE)', async () => {
    const adminCookies = await registerAdminAndLogin('rt-mix-admin');
    const res = await request(app).post('/admin/codes').set('Cookie', adminCookies)
      .send(redeemBody({ rewards: [{ pillId: 'hoi-khi-dan', congPhapId: 'thiet-cot-quyet', quantity: 1 }] }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REDEEM_CODE');
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
