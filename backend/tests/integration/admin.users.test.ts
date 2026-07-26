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
  await prisma.ownedCongPhap.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /admin/users', () => {
  it('lists users with realm and Linh Thạch context', async () => {
    const token = await registerAdminAndLogin('userlist-admin');
    await request(app).post('/auth/register').send({ username: 'zzz-player', password: 'password123' });
    await prisma.character.update({ where: { userId: (await prisma.user.findUnique({ where: { username: 'zzz-player' } }))!.id }, data: { linhThach: 320 } });

    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.users.find((u: { username: string }) => u.username === 'zzz-player');
    expect(found).toBeDefined();
    expect(found.linhThach).toBe(320);
    expect(typeof found.realmMajor).toBe('number');
    expect(found.id).toBeTruthy();
  });

  it('filters by q, case-insensitively', async () => {
    const token = await registerAdminAndLogin('search-admin');
    await request(app).post('/auth/register').send({ username: 'AliceCultivator', password: 'password123' });
    await request(app).post('/auth/register').send({ username: 'bob-the-builder', password: 'password123' });

    const res = await request(app).get('/admin/users?q=alice').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { username: string }) => u.username)).toEqual(['AliceCultivator']);
  });

  it('caps limit at 50 even when a bigger one is requested', async () => {
    const token = await registerAdminAndLogin('limit-admin');
    const res = await request(app).get('/admin/users?limit=9999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeLessThanOrEqual(50);
  });

  it('is forbidden for a non-admin (403)', async () => {
    const token = await registerAndLogin('users-nonadmin');
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
