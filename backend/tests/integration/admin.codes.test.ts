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

function codeBody(over: Record<string, unknown> = {}) {
  return { id: 'ac-code-1', code: 'ACTEST', active: true, maxRedemptions: 3, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 1 }], ...over };
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});
beforeEach(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'ACTEST' } } });
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => {
  await prisma.redemption.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCodeReward.deleteMany({ where: { code: { code: { startsWith: 'ACTEST' } } } });
  await prisma.redeemCode.deleteMany({ where: { code: { startsWith: 'ACTEST' } } });
  await prisma.$disconnect();
});

describe('/admin/codes', () => {
  it('rejects a non-admin with 403', async () => {
    const cookies = await registerAndLogin('ac-user');
    expect((await request(app).get('/admin/codes').set('Cookie', cookies)).status).toBe(403);
  });

  it('admin CRUD: create → list → update → list', async () => {
    const cookies = await registerAdminAndLogin('ac-admin');
    const post = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody());
    expect(post.status).toBe(201);
    expect(post.body.code).toBe('ACTEST');

    const list = await request(app).get('/admin/codes').set('Cookie', cookies);
    expect(list.status).toBe(200);
    expect(list.body.codes.some((c: { id: string }) => c.id === 'ac-code-1')).toBe(true);

    const put = await request(app).put('/admin/codes/ac-code-1').set('Cookie', cookies).send({ active: false, maxRedemptions: 10, expiresAt: null, rewards: [{ pillId: 'hoi-khi-dan', quantity: 5 }] });
    expect(put.status).toBe(200);
    expect(put.body.active).toBe(false);
    expect(put.body.maxRedemptions).toBe(10);
  });

  it('returns 409 REDEEM_CODE_TAKEN for duplicate code', async () => {
    const cookies = await registerAdminAndLogin('ac-admin2');
    await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody());
    const res = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody({ id: 'ac-code-2' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REDEEM_CODE_TAKEN');
  });

  it('returns 400 INVALID_REDEEM_CODE for bad maxRedemptions', async () => {
    const cookies = await registerAdminAndLogin('ac-admin3');
    const res = await request(app).post('/admin/codes').set('Cookie', cookies).send(codeBody({ maxRedemptions: 0 }));
    expect(res.status).toBe(400);
  });
});
