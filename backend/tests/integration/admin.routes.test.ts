import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/infrastructure/db/prisma';

const app = createApp();

async function registerAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

async function registerAdminAndLogin(username: string): Promise<string> {
  await request(app).post('/auth/register').send({ username, password: 'password123' });
  // Promote directly in the DB, then log in so the access token carries role:admin.
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeAll(async () => {
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Restore the seeded config so later suites see the standard 12×5 data.
  const { execSync } = await import('node:child_process');
  execSync('npm run db:seed', { cwd: process.cwd(), stdio: 'ignore' });
  await prisma.$disconnect();
});

describe('/admin/realms', () => {
  it('rejects a non-admin with 403', async () => {
    const token = await registerAndLogin('bob');
    const res = await request(app).get('/admin/realms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin read the current config', async () => {
    const token = await registerAdminAndLogin('root');
    const res = await request(app).get('/admin/realms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.realms[0].subStages[0].linhKhiRequired).toBe(100);
  });

  it('applies a PUT and reflects it immediately on /cultivation/state', async () => {
    const adminToken = await registerAdminAndLogin('root');
    // Read current config, bump realm 0 sub 0's linhKhiRequired, put it back.
    const current = await request(app).get('/admin/realms').set('Authorization', `Bearer ${adminToken}`);
    const realms = current.body.realms;
    realms[0].subStages[0].linhKhiRequired = 123;

    const put = await request(app).put('/admin/realms')
      .set('Authorization', `Bearer ${adminToken}`).send({ realms });
    expect(put.status).toBe(200);

    // A fresh player at realm 0 sub 0 should now see the new requirement.
    const playerToken = await registerAndLogin('alice');
    const state = await request(app).get('/cultivation/state').set('Authorization', `Bearer ${playerToken}`);
    expect(state.body.linhKhiRequired).toBe(123);
  });

  it('rejects an invalid PUT (non-increasing linhKhi) with 400', async () => {
    const adminToken = await registerAdminAndLogin('root');
    const res = await request(app).put('/admin/realms').set('Authorization', `Bearer ${adminToken}`).send({
      realms: [{ name: 'A', subStages: [
        { name: 'A0', linhKhiRequired: 200, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
        { name: 'A1', linhKhiRequired: 100, cultivationRate: 1, baseSuccessRate: 90, pityIncrement: 10, maxSuccessRate: 95, punishmentSeconds: 300 },
      ] }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REALM_CONFIG');
  });
});
