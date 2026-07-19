import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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
  await prisma.user.update({ where: { username }, data: { role: 'admin' } });
  const login = await request(app).post('/auth/login').send({ username, password: 'password123' });
  return login.body.token as string;
}

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /admin/stats', () => {
  it('rejects a non-admin with 403', async () => {
    const token = await registerAndLogin('pleb');
    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns counts matching the data this test created', async () => {
    const adminToken = await registerAdminAndLogin('root-stats');
    // Usernames must satisfy registerSchema's min(3) — 'a'/'b' would be
    // silently rejected with 400 and the counts below would be wrong.
    await registerAndLogin('alpha');
    await registerAndLogin('bravo');
    // Move bravo's character to realm 1 and punish alpha's character.
    await prisma.character.updateMany({
      where: { user: { username: 'bravo' } },
      data: { realmMajor: 1 },
    });
    await prisma.character.updateMany({
      where: { user: { username: 'alpha' } },
      data: { punishedUntil: new Date(Date.now() + 60_000) },
    });

    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBe(3);
    expect(res.body.totalAdmins).toBe(1);
    expect(res.body.punishedCount).toBe(1);
    // root + a in realm 0, b in realm 1; names come from the seeded config.
    expect(res.body.realmDistribution).toEqual([
      { realmMajor: 0, realmName: 'Phàm Nhân', count: 2 },
      { realmMajor: 1, realmName: 'Luyện Khí', count: 1 },
    ]);
  });
});
